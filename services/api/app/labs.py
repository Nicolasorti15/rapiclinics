"""Import and review lab reports; plot only explicitly confirmed numeric results."""

import csv
import hashlib
import io
import math
import re
from datetime import date
from pathlib import PurePosixPath
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import db_session, uid
from .models import Encounter, LabReport, Patient
from .providers import PdfTextExtractor, identity_match
from .schemas import StrictModel
from .security import ADMIN_ROLES, CLINICAL_ROLES, audit, encounter_access, get_user, require_role

router = APIRouter()


class LabRow(StrictModel):
    analyte: str = Field(min_length=1, max_length=80)
    date: date
    value: float = Field(ge=0, allow_inf_nan=False)
    unit: str = Field(min_length=1, max_length=40)

    @field_validator("analyte", "unit")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("No se aceptan campos vacíos")
        return value.strip()

    @field_validator("date")
    @classmethod
    def not_future(cls, value):
        if value > date.today():
            raise ValueError("La fecha no puede estar en el futuro")
        return value


class LabReview(StrictModel):
    scan_id: str
    reviewed: Literal[True]
    identity_manually_checked: bool = False
    rows: list[LabRow] = Field(min_length=1, max_length=100)


def extract_rows(text: str, csv_file: bool) -> list[dict]:
    if csv_file:
        delimiter = ";" if ";" in text.splitlines()[0] else ","
        source = csv.DictReader(io.StringIO(text), delimiter=delimiter)
        if not {"fecha", "variable", "valor", "unidad", "paciente"}.issubset(source.fieldnames or []):
            raise HTTPException(422, "CSV requiere columnas paciente, fecha, variable, valor, unidad.")
        rows = [
            {"date": r["fecha"], "analyte": r["variable"], "value": r["valor"], "unit": r["unidad"]}
            for r in source
        ]
    else:
        dates = re.findall(r"\b\d{4}-\d{2}-\d{2}\b", text)
        dated = dates[0] if len(set(dates)) == 1 else ""
        # Conservative recognizer. Ambiguous dates stay blank for human review.
        pattern = r"(?im)^\s*(leucocitos|glóbulos blancos|globulos blancos|WBC|hemoglobina|hematocrito|plaquetas|neutrófilos|neutrofilos|linfocitos|glucosa|creatinina)\s*[:\t ]+([0-9]+(?:[.,][0-9]+)?)\s+([^\r\n]+)"
        rows = [
            {"date": dated, "analyte": m[0], "value": m[1], "unit": m[2].strip()}
            for m in re.findall(pattern, text)
        ]
    if len(rows) > 100:
        raise HTTPException(422, "Máximo 100 resultados por informe.")
    return rows


def access(db, user, report_id):
    report = db.get(LabReport, report_id)
    if not report:
        raise HTTPException(404, "Informe no encontrado.")
    encounter_access(db, user, report.encounter_id)
    return report


def public(report):
    from .main import serialize

    return serialize(report, {"storage_key"})


@router.get("/patients/{patient_id}/labs")
def reports(patient_id: str, user=Depends(get_user), db: Session = Depends(db_session)):
    from .main import patient_context

    patient_context(db, user, patient_id)
    query = select(LabReport).join(Encounter).where(LabReport.patient_id == patient_id)
    if user.role not in ADMIN_ROLES:
        query = query.where(Encounter.service == user.unit)
    return [public(r) for r in db.scalars(query.order_by(LabReport.created_at.desc())).all()]


@router.post("/patients/{patient_id}/labs", status_code=201)
async def import_report(
    patient_id: str,
    request: Request,
    scan_id: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(get_user),
    db: Session = Depends(db_session),
):
    from .main import limited_read, valid_scan

    require_role(user, CLINICAL_ROLES)
    scan, _, encounter = valid_scan(db, user, scan_id)
    patient = db.get(Patient, patient_id)
    if scan.patient_id != patient_id:
        raise HTTPException(409, "Confirma el paciente de este informe.")
    filename = PurePosixPath((file.filename or "").replace("\\", "/")).name[:200]
    content = await limited_read(file, 10 * 1024 * 1024)
    is_csv = filename.lower().endswith(".csv")
    if is_csv:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise HTTPException(422, "Guarda el CSV en UTF-8.") from exc
    elif filename.lower().endswith(".pdf") and content.startswith(b"%PDF-"):
        text = PdfTextExtractor().extract(content)
    else:
        raise HTTPException(415, "Selecciona un PDF con texto o un CSV.")
    if not text.strip():
        raise HTTPException(422, "El informe no contiene texto; OCR de imágenes aún no disponible.")
    if len(text) > 500000:
        raise HTTPException(413, "Informe demasiado largo.")
    rows = extract_rows(text, is_csv)
    status, _ = identity_match(text, patient.identifier)
    sha = hashlib.sha256(content).hexdigest()
    if db.scalar(select(LabReport.id).where(LabReport.patient_id == patient_id, LabReport.sha256 == sha)):
        raise HTTPException(409, "Este informe ya se importó. Revísalo en la lista.")
    report = LabReport(
        patient_id=patient_id,
        encounter_id=encounter.id,
        filename=filename,
        content_type="text/csv" if is_csv else "application/pdf",
        storage_key=uid(),
        sha256=sha,
        extracted_text=text,
        identity_status=status,
        rows=rows,
    )
    db.add(report)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Este informe ya se importó.") from exc
    request.app.state.storage.put(report.storage_key, content, db=db)
    audit(db, user, "lab_imported", report.id)
    db.commit()
    return public(report)


@router.get("/labs/{report_id}/file")
def original(report_id: str, request: Request, user=Depends(get_user), db: Session = Depends(db_session)):
    report = access(db, user, report_id)
    content = request.app.state.storage.get(report.storage_key)
    if hashlib.sha256(content).hexdigest() != report.sha256:
        raise HTTPException(409, "No se pudo verificar el original.")
    return Response(
        content,
        media_type=report.content_type,
        headers={"Content-Disposition": "attachment; filename=resultado"},
    )


@router.post("/labs/{report_id}/confirm")
def confirm(report_id: str, body: LabReview, user=Depends(get_user), db: Session = Depends(db_session)):
    from .main import valid_scan

    require_role(user, CLINICAL_ROLES)
    report = access(db, user, report_id)
    scan, _, encounter = valid_scan(db, user, body.scan_id)
    if report.patient_id != scan.patient_id or report.encounter_id != encounter.id:
        raise HTTPException(409, "El contexto no corresponde a este informe.")
    if report.status != "REVIEW_REQUIRED":
        raise HTTPException(409, "El informe ya está confirmado.")
    if report.identity_status == "MISMATCH":
        raise HTTPException(409, "El documento tiene otro identificador de paciente.")
    if report.identity_status != "MATCH" and not body.identity_manually_checked:
        raise HTTPException(422, "Comprueba manualmente la identidad del paciente.")
    rows = [r.model_dump(mode="json") for r in body.rows]
    if any(not math.isfinite(r["value"]) for r in rows):
        raise HTTPException(422, "Valor numérico inválido.")
    report.rows, report.status, report.validated_by = rows, "CONFIRMED", user.id
    audit(db, user, "lab_confirmed", report.id)
    db.commit()
    return public(report)
