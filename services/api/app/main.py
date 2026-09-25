import hashlib
import os
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import PurePosixPath

from argon2.exceptions import VerificationError
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import db_session, now, uid
from .models import (
    Assignment,
    AuthSession,
    Bed,
    Document,
    Encounter,
    Extraction,
    LabReport,
    Patient,
    Scan,
    Tag,
    Task,
    User,
    Visit,
)
from .providers import (
    ExtractiveDemoStructurer,
    ExtractiveDocumentSummary,
    MockEhrAdapter,
    PdfTextExtractor,
    grounded_redaction,
    identity_match,
)
from .schemas import (
    ConfirmPatient,
    CreateVisit,
    DocumentValidation,
    Draft,
    EhrSubmission,
    Login,
    LocalClinicalProposal,
    NoteReview,
    Refresh,
    Resolve,
    TaskUpdate,
)
from .security import (
    ADMIN_ROLES,
    clinic_active,
    public_user,
    CLINICAL_ROLES,
    DOCUMENT_ROLES,
    audit,
    digest,
    encounter_access,
    encounter_read_access,
    future,
    get_user,
    hasher,
    issue_session,
    require_role,
)
from .storage import ObjectStorage
from .speech import LocalSpeechToText
from .labs import router as labs_router
from .administration import router as admin_router


@asynccontextmanager
async def lifespan(app):
    from .settings import validate_deployment

    validate_deployment()
    app.state.storage = ObjectStorage()
    yield


app = FastAPI(title="RAPICLINICS API", version="0.2.0", lifespan=lifespan)
app.include_router(labs_router)
app.include_router(admin_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "CORS_ORIGINS", "http://localhost:8081,http://localhost:8082,http://127.0.0.1:8081"
    ).split(","),
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)
rate_buckets = defaultdict(deque)


@app.middleware("http")
async def headers_and_limits(request: Request, call_next):
    if request.url.path in {"/auth/login", "/auth/register", "/auth/refresh", "/nfc/resolve"}:
        key = (request.client.host if request.client else "unknown", request.url.path)
        bucket = rate_buckets[key]
        clock = time.monotonic()
        while bucket and bucket[0] < clock - 60:
            bucket.popleft()
        if len(bucket) >= (10 if request.url.path in {"/auth/login", "/auth/register"} else 60):
            return Response(
                '{"detail":"Demasiados intentos. Espera un minuto."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": "60"},
            )
        bucket.append(clock)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Request-ID"] = uid()
    return response


def serialize(entity, excluded=()):
    return {
        column.name: getattr(entity, column.name)
        for column in entity.__table__.columns
        if column.name not in excluded
    }


def patient_context(db, user, patient_id):
    patient = db.get(Patient, patient_id)
    if not patient or patient.clinic_id != user.clinic_id:
        raise HTTPException(404, "Paciente no disponible.")
    encounters = db.scalars(
        select(Encounter).where(
            Encounter.patient_id == patient_id,
            Encounter.clinic_id == user.clinic_id,
            Encounter.status == "ACTIVE",
        )
    ).all()
    encounter = next(
        (item for item in encounters if item.service == user.unit),
        encounters[0] if encounters else None,
    )
    if not encounter:
        raise HTTPException(404, "Paciente sin episodio activo disponible.")
    assignment = db.scalar(
        select(Assignment).where(Assignment.encounter_id == encounter.id, Assignment.status == "ACTIVE")
    )
    bed = db.get(Bed, assignment.bed_id) if assignment else None
    return {
        **serialize(patient),
        "encounter_id": encounter.id,
        "service": encounter.service,
        "bed": bed.code if bed else "Sin cama",
        "admission_at": encounter.admission_at,
    }


def valid_scan(db, user, scan_id, confirmed=True):
    scan = db.get(Scan, scan_id)
    if not scan or scan.user_id != user.id:
        raise HTTPException(404, "Lectura no disponible.")
    assignment = db.get(Assignment, scan.assignment_id)
    encounter = encounter_access(db, user, assignment.encounter_id)
    tag = db.get(Tag, scan.tag_id) if scan.tag_id else None
    if (
        scan.expires_at < now()
        or assignment.status != "ACTIVE"
        or encounter.status != "ACTIVE"
        or (tag and tag.status != "ACTIVE")
    ):
        raise HTTPException(
            409, "La asignación ha cambiado o la lectura caducó. Vuelve a identificar al paciente."
        )
    if encounter.patient_id != scan.patient_id or (confirmed and not scan.confirmed):
        raise HTTPException(409, "Confirma primero la identidad del paciente.")
    return scan, assignment, encounter


def visit_access(db, user, visit_id, edit=False):
    visit = db.get(Visit, visit_id)
    if not visit:
        raise HTTPException(404, "Visita no encontrada.")
    encounter_access(db, user, visit.encounter_id)
    if edit:
        require_role(user, CLINICAL_ROLES)
        if visit.created_by != user.id or visit.status not in {"DRAFT", "REVIEW_REQUIRED"}:
            raise HTTPException(409, "La visita no admite cambios.")
        valid_scan(db, user, visit.scan_id)
    return visit


def document_read_access(db, user, document_id):
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(404, "Documento no encontrado.")

    encounter_read_access(db, user, document.encounter_id)
    return document


def document_write_access(db, user, document_id):
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(404, "Documento no encontrado.")

    encounter_access(db, user, document.encounter_id)
    return document


def document_access(db, user, document_id):
    """Compatibilidad temporal: acceso estricto para operaciones de escritura."""
    return document_write_access(db, user, document_id)


def document_response(db, document):
    extraction = db.scalar(select(Extraction).where(Extraction.document_id == document.id))
    return {
        **serialize(document, {"storage_key"}),
        "extraction": serialize(extraction) if extraction else None,
    }


@app.get("/health")
def health(db: Session = Depends(db_session)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "mode": os.getenv("APP_MODE", "demo"), "version": "0.2.0"}


@app.post("/auth/login")
def login(body: Login, db: Session = Depends(db_session)):
    user = db.scalar(select(User).where(User.email == body.email.lower(), User.active.is_(True)))
    try:
        if not user or not clinic_active(db, user) or not hasher.verify(user.password_hash, body.password):
            raise ValueError()
    except (VerificationError, ValueError):
        audit(db, None, "login_failed")
        db.commit()
        raise HTTPException(401, "Correo o contraseña incorrectos.")
    result = issue_session(db, user)
    audit(db, user, "login")
    db.commit()
    return result


@app.post("/auth/refresh")
def refresh(body: Refresh, db: Session = Depends(db_session)):
    session = db.scalar(
        select(AuthSession).where(
            AuthSession.refresh_hash == digest(body.refresh_token),
            AuthSession.revoked.is_(False),
            AuthSession.refresh_expires_at > now(),
        )
    )
    user = db.get(User, session.user_id) if session else None
    if not user or not user.active or not clinic_active(db, user):
        raise HTTPException(401, "Sesión caducada.")
    changed = db.execute(
        update(AuthSession)
        .where(AuthSession.id == session.id, AuthSession.revoked.is_(False))
        .values(revoked=True)
    )
    if changed.rowcount != 1:
        raise HTTPException(401, "La sesión ya se renovó.")
    result = issue_session(db, user)
    db.commit()
    return result


@app.post("/auth/logout")
def logout(request: Request, user=Depends(get_user), db: Session = Depends(db_session)):
    token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    db.execute(update(AuthSession).where(AuthSession.token_hash == digest(token)).values(revoked=True))
    audit(db, user, "logout")
    db.commit()
    return {"ok": True}


@app.get("/auth/me")
def me(user=Depends(get_user), db: Session = Depends(db_session)):
    return public_user(db, user)


@app.get("/patients")
def patients(user=Depends(get_user), db: Session = Depends(db_session)):
    require_role(user, DOCUMENT_ROLES)
    encounters = db.scalars(
        select(Encounter).where(
            Encounter.status == "ACTIVE",
            Encounter.clinic_id == user.clinic_id,
        )
    ).all()

    patient_ids = list(dict.fromkeys(encounter.patient_id for encounter in encounters))

    return [patient_context(db, user, patient_id) for patient_id in patient_ids]


@app.get("/patients/{patient_id}")
@app.get("/patients/{patient_id}/summary")
def patient(patient_id: str, user=Depends(get_user), db: Session = Depends(db_session)):
    result = patient_context(db, user, patient_id)
    audit(db, user, "patient_view", patient_id)
    db.commit()
    return result


@app.get("/patients/{patient_id}/clinical-brief")
def clinical_brief(patient_id: str, user=Depends(get_user), db: Session = Depends(db_session)):
    """Grounded patient brief. It reports stored facts and numeric direction only."""
    patient = patient_context(db, user, patient_id)
    visits = db.scalars(
        select(Visit)
        .where(Visit.patient_id == patient_id, Visit.status == "CONFIRMED")
        .order_by(Visit.created_at.desc())
        .limit(5)
    ).all()
    tasks = db.scalars(
        select(Task)
        .where(Task.patient_id == patient_id, Task.status == "OPEN")
        .order_by(Task.created_at.desc())
        .limit(10)
    ).all()
    documents = db.execute(
        select(Document, Extraction)
        .join(Extraction, Extraction.document_id == Document.id)
        .where(Document.patient_id == patient_id, Document.status == "VALIDATED")
        .order_by(Document.created_at.desc())
        .limit(3)
    ).all()
    reports = db.scalars(
        select(LabReport)
        .where(LabReport.patient_id == patient_id, LabReport.status == "CONFIRMED")
        .order_by(LabReport.created_at.desc())
    ).all()

    key_points = []
    if patient["allergies"].strip():
        key_points.append(
            {
                "kind": "allergy",
                "label": "Alergias registradas",
                "text": patient["allergies"].strip(),
                "source_id": patient_id,
                "source_type": "patient",
            }
        )
    for visit in visits[:3]:
        reviewed = (visit.note or {}).get("reviewed_evolution", "").strip()
        if reviewed:
            key_points.append(
                {
                    "kind": "evolution",
                    "label": f"Evolución del {visit.confirmed_at or visit.created_at}",
                    "text": reviewed[:1200],
                    "source_id": visit.id,
                    "source_type": "visit",
                }
            )
    for document, extraction in documents:
        if extraction.summary.strip():
            key_points.append(
                {
                    "kind": "document",
                    "label": document.filename,
                    "text": extraction.summary.strip()[:1200],
                    "source_id": document.id,
                    "source_type": "document",
                }
            )

    grouped = defaultdict(list)
    for report in reports:
        for row in report.rows or []:
            try:
                value = float(row["value"])
                analyte = str(row["analyte"]).strip()
                unit = str(row["unit"]).strip()
                measured = str(row["date"])
            except (KeyError, TypeError, ValueError):
                continue
            grouped[(analyte.casefold(), unit)].append(
                {
                    "date": measured,
                    "value": value,
                    "analyte": analyte,
                    "unit": unit,
                    "report_id": report.id,
                    "filename": report.filename,
                }
            )
    lab_trends = []
    for values in grouped.values():
        values.sort(key=lambda item: item["date"])
        latest = values[-1]
        previous = values[-2] if len(values) > 1 else None
        direction = "sin comparación"
        delta = None
        if previous:
            delta = latest["value"] - previous["value"]
            tolerance = max(abs(previous["value"]) * 0.001, 1e-9)
            direction = "estable" if abs(delta) <= tolerance else ("aumentó" if delta > 0 else "disminuyó")
        lab_trends.append(
            {
                **latest,
                "previous_date": previous["date"] if previous else None,
                "previous_value": previous["value"] if previous else None,
                "delta": delta,
                "direction": direction,
                "count": len(values),
            }
        )
    lab_trends.sort(key=lambda item: (item["analyte"].casefold(), item["unit"]))

    response = {
        "generated_at": now(),
        "method": "grounded-extractive-v1",
        "disclaimer": "Resume información registrada y cambios numéricos. No diagnostica ni recomienda conductas.",
        "overview": (
            f"{len(visits)} evoluciones confirmadas, {len(documents)} documentos validados, "
            f"{len(reports)} informes de laboratorio y {len(tasks)} pendientes abiertos revisados."
        ),
        "key_points": key_points[:8],
        "open_tasks": [{"id": task.id, "text": task.description, "due_at": task.due_at} for task in tasks],
        "lab_trends": lab_trends,
    }
    audit(db, user, "clinical_brief_viewed", patient_id)
    db.commit()
    return response


@app.post("/nfc/resolve")
def resolve(body: Resolve, user=Depends(get_user), db: Session = Depends(db_session)):
    tag = db.scalar(select(Tag).where(Tag.token_hash == digest(body.token)))
    if not tag or tag.status != "ACTIVE":
        audit(db, user, "nfc_rejected")
        db.commit()
        raise HTTPException(404, "Etiqueta no registrada o revocada.")
    if tag.patient_id:
        tagged_patient = db.get(Patient, tag.patient_id)
        if not tagged_patient or tagged_patient.clinic_id != user.clinic_id:
            raise HTTPException(404, "Etiqueta no disponible.")
        assignment = db.scalar(
            select(Assignment)
            .join(Encounter)
            .where(
                Encounter.patient_id == tag.patient_id,
                Encounter.clinic_id == user.clinic_id,
                Encounter.status == "ACTIVE",
                Assignment.status == "ACTIVE",
            )
        )
    else:
        bed = db.get(Bed, tag.bed_id)
        if not bed or bed.clinic_id != user.clinic_id:
            raise HTTPException(404, "Etiqueta no disponible.")
        assignment = db.scalar(
            select(Assignment).where(Assignment.bed_id == tag.bed_id, Assignment.status == "ACTIVE")
        )
    if not assignment:
        raise HTTPException(409, "Esta cama no tiene un paciente asignado.")
    encounter = encounter_access(db, user, assignment.encounter_id)
    if encounter.status != "ACTIVE":
        raise HTTPException(409, "El episodio ya no está activo.")
    scan = Scan(
        user_id=user.id,
        assignment_id=assignment.id,
        patient_id=encounter.patient_id,
        tag_id=tag.id,
        expires_at=future(60),
    )
    db.add(scan)
    db.flush()
    audit(db, user, "nfc_scan", scan.id)
    result = {
        "scan_id": scan.id,
        "requires_confirmation": True,
        "patient": patient_context(db, user, scan.patient_id),
    }
    db.commit()
    return result


@app.post("/demo/patients/{patient_id}/identify")
def demo_identify(patient_id: str, user=Depends(get_user), db: Session = Depends(db_session)):
    if os.getenv("APP_MODE", "demo") != "demo":
        raise HTTPException(404, "Función de demostración deshabilitada.")
    return identify_patient(patient_id, user, db)


@app.post("/patients/{patient_id}/identify")
def identify_patient(patient_id: str, user=Depends(get_user), db: Session = Depends(db_session)):
    context = patient_context(db, user, patient_id)
    assignment = db.scalar(
        select(Assignment).where(
            Assignment.encounter_id == context["encounter_id"], Assignment.status == "ACTIVE"
        )
    )
    if not assignment:
        raise HTTPException(409, "Paciente sin cama asignada.")
    scan = Scan(user_id=user.id, assignment_id=assignment.id, patient_id=patient_id, expires_at=future(60))
    db.add(scan)
    db.flush()
    audit(db, user, "manual_identification", scan.id)
    db.commit()
    return {"scan_id": scan.id, "requires_confirmation": True, "patient": context}


@app.post("/nfc/scans/{scan_id}/confirm")
def confirm_patient(
    scan_id: str, body: ConfirmPatient, user=Depends(get_user), db: Session = Depends(db_session)
):
    scan, _, _ = valid_scan(db, user, scan_id, confirmed=False)
    if body.confirmed_patient_id != scan.patient_id:
        raise HTTPException(409, "El paciente no coincide con la lectura.")
    scan.confirmed = True
    audit(db, user, "patient_confirmed", scan.id)
    db.commit()
    return {"scan_id": scan.id, "patient": patient_context(db, user, scan.patient_id)}


@app.post("/visits", status_code=201)
def create_visit(body: CreateVisit, user=Depends(get_user), db: Session = Depends(db_session)):
    require_role(user, CLINICAL_ROLES)
    scan, _, encounter = valid_scan(db, user, body.scan_id)
    visit = Visit(encounter_id=encounter.id, patient_id=scan.patient_id, scan_id=scan.id, created_by=user.id)
    db.add(visit)
    db.flush()
    audit(db, user, "visit_created", visit.id)
    db.commit()
    return serialize(visit)


@app.get("/visits/{visit_id}")
def get_visit(visit_id: str, user=Depends(get_user), db: Session = Depends(db_session)):
    return serialize(visit_access(db, user, visit_id), {"audio_key"})


@app.patch("/visits/{visit_id}/draft")
def draft(visit_id: str, body: Draft, user=Depends(get_user), db: Session = Depends(db_session)):
    visit = visit_access(db, user, visit_id, edit=True)
    if body.evolution is not None and (
        visit.status != "REVIEW_REQUIRED" or body.transcript != visit.transcript
    ):
        raise HTTPException(409, "Genera la propuesta antes de guardar su revisión.")
    if any(len(item) > 1000 for item in body.tasks):
        raise HTTPException(422, "Un pendiente es demasiado largo.")
    if body.original_transcript:
        if visit.original_transcript and visit.original_transcript != body.original_transcript:
            raise HTTPException(409, "La transcripción original ya fue registrada y no puede reemplazarse.")
        visit.original_transcript = body.original_transcript
    visit.transcript = body.transcript
    if body.evolution is not None:
        visit.note = {**visit.note, "draft_evolution": body.evolution, "draft_tasks": body.tasks}
    else:
        visit.note = {}
        visit.status = "DRAFT"
    db.commit()
    return serialize(visit, {"audio_key"})


async def limited_read(file, maximum):
    chunks, size = [], 0
    while chunk := await file.read(65536):
        size += len(chunk)
        if size > maximum:
            raise HTTPException(413, "El archivo supera el límite de 10 MB.")
        chunks.append(chunk)
    if not size:
        raise HTTPException(422, "El archivo está vacío.")
    return b"".join(chunks)


@app.post("/visits/{visit_id}/audio")
async def audio(
    visit_id: str,
    request: Request,
    file: UploadFile = File(...),
    user=Depends(get_user),
    db: Session = Depends(db_session),
):
    visit = visit_access(db, user, visit_id, edit=True)
    if file.content_type not in {"audio/mp4", "audio/m4a", "audio/x-m4a", "audio/webm", "audio/wav"}:
        raise HTTPException(415, "Formato de audio no admitido.")
    content = await limited_read(file, 10 * 1024 * 1024)
    key = uid()
    request.app.state.storage.put(key, content, db=db)
    visit.audio_key = key
    visit.original_transcript = ""
    audit(db, user, "audio_uploaded", visit.id)
    db.commit()
    return {"status": "UPLOADED", "simulation": False}


@app.post("/visits/{visit_id}/transcribe")
def transcribe(visit_id: str, request: Request, user=Depends(get_user), db: Session = Depends(db_session)):
    visit = visit_access(db, user, visit_id, edit=True)
    if not visit.audio_key:
        raise HTTPException(409, "Graba o adjunta audio primero.")
    audio_key = visit.audio_key
    result = LocalSpeechToText().transcribe(request.app.state.storage.get(audio_key))
    db.refresh(visit)
    visit_access(db, user, visit_id, edit=True)
    if visit.audio_key != audio_key:
        raise HTTPException(409, "El audio cambió durante la transcripción. Vuelve a intentarlo.")
    visit.transcript = result
    visit.original_transcript = result
    visit.note, visit.status = {}, "DRAFT"
    db.commit()
    return {
        "transcript": visit.transcript,
        "simulation": False,
        "message": "Transcripción automática local. Comprueba el dictado antes de confirmarlo.",
    }


@app.post("/visits/{visit_id}/local-structure")
def local_structure(
    visit_id: str,
    body: LocalClinicalProposal,
    user=Depends(get_user),
    db: Session = Depends(db_session),
):
    visit = visit_access(db, user, visit_id, edit=True)

    if not visit.transcript.strip():
        raise HTTPException(
            422,
            "Añade una transcripción antes de continuar.",
        )

    allowed_methods = {
        "qwen3-1.7b-q4_k_m-local-v1",
        "qwen3-0.6b-q4_k_m-fast-local-v1",
        "qwen3-0.6b-q4_k_m-fast-local-v2",
        "local-conservative-fast-v2",
    }

    if body.redaction_method not in allowed_methods:
        raise HTTPException(
            422,
            "Método de redacción local no reconocido.",
        )

    if not grounded_redaction(body.suggested_evolution, visit.transcript):
        raise HTTPException(
            422,
            "La redacción propuesta contiene información que no está en la transcripción.",
        )

    def validated_items(items):
        result = []

        for item in items:
            if item.source_span not in visit.transcript:
                raise HTTPException(
                    422,
                    "La propuesta contiene una referencia que no existe en la transcripción.",
                )

            result.append(
                {
                    "text": item.text,
                    "source_span": item.source_span,
                    "requires_review": True,
                }
            )

        return result

    visit.note = {
        "evolution": validated_items(body.evolution),
        "tasks": validated_items(body.tasks),
        "uncertainties": validated_items(body.uncertainties),
        "suggested_evolution": body.suggested_evolution,
        "redaction_method": body.redaction_method,
    }

    visit.status = "REVIEW_REQUIRED"

    audit(
        db,
        user,
        "visit_local_structure",
        visit.id,
        redaction_method=body.redaction_method,
    )

    db.commit()
    return serialize(visit, {"audio_key"})


@app.post("/visits/{visit_id}/structure")
def structure(visit_id: str, user=Depends(get_user), db: Session = Depends(db_session)):
    visit = visit_access(db, user, visit_id, edit=True)
    if not visit.transcript.strip():
        raise HTTPException(422, "Añade una transcripción antes de continuar.")
    visit.note = ExtractiveDemoStructurer().structure(visit.transcript)
    visit.status = "REVIEW_REQUIRED"
    db.commit()
    return serialize(visit, {"audio_key"})


@app.post("/visits/{visit_id}/confirm")
def confirm_visit(visit_id: str, body: NoteReview, user=Depends(get_user), db: Session = Depends(db_session)):
    visit = visit_access(db, user, visit_id, edit=True)
    if visit.status != "REVIEW_REQUIRED":
        raise HTTPException(409, "Genera y revisa la propuesta primero.")
    tasks = list(dict.fromkeys(item.strip() for item in body.tasks if item.strip()))
    if any(len(item) > 1000 for item in tasks):
        raise HTTPException(422, "Un pendiente es demasiado largo.")
    confirmed_at = now()
    changed = db.execute(
        update(Visit)
        .where(Visit.id == visit.id, Visit.status == "REVIEW_REQUIRED")
        .values(
            note={**visit.note, "reviewed_evolution": body.evolution, "reviewed_tasks": tasks},
            status="CONFIRMED",
            confirmed_at=confirmed_at,
            validated_by=user.id,
        )
    )
    if changed.rowcount != 1:
        raise HTTPException(409, "Esta visita ya fue confirmada.")
    for description in tasks:
        db.add(
            Task(
                patient_id=visit.patient_id,
                encounter_id=visit.encounter_id,
                visit_id=visit.id,
                description=description,
            )
        )
    audit(db, user, "visit_confirmed", visit.id)
    db.commit()
    db.refresh(visit)
    return serialize(visit, {"audio_key"})


@app.post("/visits/{visit_id}/discard")
def discard_visit(visit_id: str, user=Depends(get_user), db: Session = Depends(db_session)):
    visit = visit_access(db, user, visit_id, edit=True)
    visit.status = "DISCARDED"
    audit(db, user, "visit_discarded", visit.id)
    db.commit()
    return {"ok": True}


@app.get("/tasks")
def tasks(patient_id: str | None = None, user=Depends(get_user), db: Session = Depends(db_session)):
    query = (
        select(Task)
        .join(Encounter, Task.encounter_id == Encounter.id)
        .where(Encounter.clinic_id == user.clinic_id)
    )
    if patient_id:
        patient_context(db, user, patient_id)
        query = query.where(Task.patient_id == patient_id)
    elif user.role not in ADMIN_ROLES:
        query = query.where(Encounter.service == user.unit)
    return [
        {**serialize(task), "patient_name": db.get(Patient, task.patient_id).name}
        for task in db.scalars(query.order_by(Task.created_at.desc())).all()
    ]


@app.patch("/tasks/{task_id}")
def task_update(task_id: str, body: TaskUpdate, user=Depends(get_user), db: Session = Depends(db_session)):
    require_role(user, CLINICAL_ROLES)
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Pendiente no encontrado.")
    encounter_access(db, user, task.encounter_id)
    task.status = body.status
    task.completed_at = now() if body.status == "DONE" else None
    audit(db, user, "task_updated", task.id, status=body.status)
    db.commit()
    return serialize(task)


@app.get("/patients/{patient_id}/timeline")
def timeline(patient_id: str, user=Depends(get_user), db: Session = Depends(db_session)):
    patient_context(db, user, patient_id)
    return [
        serialize(visit, {"audio_key"})
        for visit in db.scalars(
            select(Visit)
            .where(Visit.patient_id == patient_id, Visit.status == "CONFIRMED")
            .order_by(Visit.created_at.desc())
        ).all()
    ]


@app.get("/patients/{patient_id}/drafts")
def patient_drafts(patient_id: str, user=Depends(get_user), db: Session = Depends(db_session)):
    patient_context(db, user, patient_id)
    return [
        serialize(visit, {"audio_key"})
        for visit in db.scalars(
            select(Visit)
            .where(
                Visit.patient_id == patient_id,
                Visit.created_by == user.id,
                Visit.status.in_(["DRAFT", "REVIEW_REQUIRED"]),
            )
            .order_by(Visit.created_at.desc())
        ).all()
    ]


@app.post("/visits/{visit_id}/resume")
def resume_visit(visit_id: str, body: CreateVisit, user=Depends(get_user), db: Session = Depends(db_session)):
    require_role(user, CLINICAL_ROLES)
    visit = visit_access(db, user, visit_id)
    scan, _, encounter = valid_scan(db, user, body.scan_id)
    if visit.created_by != user.id or visit.status not in {"DRAFT", "REVIEW_REQUIRED"}:
        raise HTTPException(409, "No se puede reanudar esta visita.")
    if visit.patient_id != scan.patient_id or visit.encounter_id != encounter.id:
        raise HTTPException(409, "El borrador pertenece a otro paciente o episodio.")
    visit.scan_id = scan.id
    audit(db, user, "visit_resumed", visit.id)
    db.commit()
    return serialize(visit, {"audio_key"})


@app.get("/patients/{patient_id}/documents")
def documents(patient_id: str, user=Depends(get_user), db: Session = Depends(db_session)):
    patient_context(db, user, patient_id)
    return [
        document_response(db, document)
        for document in db.scalars(
            select(Document)
            .where(Document.candidate_patient_id == patient_id, Document.status != "DISCARDED")
            .order_by(Document.created_at.desc())
        ).all()
    ]


@app.post("/patients/{patient_id}/documents", status_code=201)
async def upload_document(
    patient_id: str,
    request: Request,
    scan_id: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(get_user),
    db: Session = Depends(db_session),
):
    require_role(user, DOCUMENT_ROLES)
    scan, _, encounter = valid_scan(db, user, scan_id)
    if scan.patient_id != patient_id:
        raise HTTPException(409, "El documento no corresponde al contexto confirmado.")
    if file.content_type != "application/pdf" or not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(415, "Selecciona un archivo PDF.")
    content = await limited_read(file, 10 * 1024 * 1024)
    if not content.startswith(b"%PDF-"):
        raise HTTPException(422, "El archivo no contiene un PDF válido.")
    sha256 = hashlib.sha256(content).hexdigest()
    if db.scalar(
        select(Document.id).where(Document.sha256 == sha256, Document.candidate_patient_id == patient_id)
    ):
        raise HTTPException(409, "Este PDF ya fue importado. Consulta el documento existente.")
    extracted = PdfTextExtractor().extract(content)
    patient = db.get(Patient, patient_id)
    match, identifiers = identity_match(extracted, patient.identifier)
    document = Document(
        candidate_patient_id=patient_id,
        encounter_id=encounter.id,
        scan_id=scan.id,
        imported_by=user.id,
        filename=PurePosixPath((file.filename or "documento.pdf").replace("\\", "/")).name[:200],
        storage_key=uid(),
        sha256=sha256,
        size_bytes=len(content),
        identity_status=match,
        document_type="CLINICAL_SUMMARY" if "resumen" in extracted.casefold() else "EXTERNAL_DOCUMENT",
    )
    db.add(document)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Este PDF ya fue importado.") from exc
    request.app.state.storage.put(document.storage_key, content, db=db)
    db.add(
        Extraction(
            document_id=document.id,
            text=extracted,
            identifiers=identifiers,
            summary=ExtractiveDocumentSummary().summarize(extracted),
        )
    )
    audit(db, user, "document_uploaded", document.id)
    if match == "MISMATCH":
        audit(db, user, "document_identity_mismatch", document.id)
    db.commit()
    return document_response(db, document)


@app.get("/documents/{document_id}")
def get_document(document_id: str, user=Depends(get_user), db: Session = Depends(db_session)):
    return document_response(db, document_read_access(db, user, document_id))


@app.get("/documents/{document_id}/file")
def document_file(
    document_id: str, request: Request, user=Depends(get_user), db: Session = Depends(db_session)
):
    document = document_read_access(db, user, document_id)
    content = request.app.state.storage.get(document.storage_key)
    if hashlib.sha256(content).hexdigest() != document.sha256:
        raise HTTPException(409, "No se pudo verificar la integridad del documento.")
    audit(db, user, "document_viewed", document.id)
    db.commit()
    return Response(
        content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="documento.pdf"',
            "Content-Security-Policy": "sandbox",
        },
    )


@app.post("/documents/{document_id}/validate")
def validate_document(
    document_id: str, body: DocumentValidation, user=Depends(get_user), db: Session = Depends(db_session)
):
    require_role(user, DOCUMENT_ROLES - {"STUDENT"})
    document = document_access(db, user, document_id)
    if document.status != "REVIEW_REQUIRED":
        raise HTTPException(409, "El documento ya no está pendiente de revisión.")
    # Later reviews require a fresh context owned by the reviewer.
    scan, _, encounter = valid_scan(db, user, body.scan_id)
    if scan.patient_id != document.candidate_patient_id or encounter.id != document.encounter_id:
        raise HTTPException(409, "La revisión pertenece a otro paciente o episodio.")
    if body.confirmed_patient_id != document.candidate_patient_id or document.identity_status == "MISMATCH":
        raise HTTPException(409, "Identidad discrepante. No se puede asociar este documento.")
    if document.identity_status != "MATCH" and not body.identity_manually_checked:
        raise HTTPException(409, "Revisa el original y confirma manualmente los identificadores.")
    document.patient_id = document.candidate_patient_id
    document.status, document.validated_by, document.validated_at = "VALIDATED", user.id, now()
    audit(
        db, user, "document_validated", document.id, identity_manually_checked=body.identity_manually_checked
    )
    db.commit()
    return document_response(db, document)


@app.post("/documents/{document_id}/discard")
def discard_document(document_id: str, user=Depends(get_user), db: Session = Depends(db_session)):
    document = document_access(db, user, document_id)
    if document.imported_by != user.id or document.status != "REVIEW_REQUIRED":
        raise HTTPException(409, "No se puede descartar este documento.")
    document.status = "DISCARDED"
    audit(db, user, "document_discarded", document.id)
    db.commit()
    return {"ok": True}


@app.post("/documents/{document_id}/ehr-submit")
def ehr_submit(
    document_id: str, body: EhrSubmission, user=Depends(get_user), db: Session = Depends(db_session)
):
    if os.getenv("APP_MODE", "demo") != "demo":
        raise HTTPException(501, "La integración con el EHR de la clínica aún no está configurada.")
    require_role(user, {"PHYSICIAN", "RECORDS_ADMIN", "SYSTEM_ADMIN"})
    document = document_access(db, user, document_id)
    if document.status != "VALIDATED" or not document.validated_by or not document.patient_id:
        raise HTTPException(409, "Valida el documento antes de enviarlo.")
    if document.ehr_status == "ACCEPTED":
        return document_response(db, document)
    if os.getenv("EHR_SIMULATE_FAILURE") == "1":
        document.ehr_status = "ERROR"
    else:
        document.ehr_payload = MockEhrAdapter().submit(document)
        document.ehr_status = "ACCEPTED"
    audit(db, user, "ehr_submission", document.id, status=document.ehr_status)
    db.commit()
    return document_response(db, document)


@app.get("/demo/patients/{patient_id}/sample-pdf")
def sample_pdf(patient_id: str, user=Depends(get_user), db: Session = Depends(db_session)):
    if os.getenv("APP_MODE", "demo") != "demo":
        raise HTTPException(404, "Función de demostración deshabilitada.")
    from .seed import fixture_pdf

    context = patient_context(db, user, patient_id)
    return Response(fixture_pdf(context["identifier"], context["name"]), media_type="application/pdf")
