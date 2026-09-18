import io
import os
import sys
from pathlib import Path

from reportlab.pdfgen import canvas
from sqlalchemy import select

from .db import SessionLocal
from .models import Assignment, Bed, Clinic, Encounter, Patient, Tag, Task, User
from .security import digest, hasher

NAMES = [
    "María González",
    "Carlos Ramírez",
    "Ana Martínez",
    "Luis Torres",
    "Sofía López",
    "Jorge Castro",
    "Elena Vargas",
    "Pedro Ruiz",
    "Lucía Moreno",
    "Andrés Rojas",
]


def fixture_token(index):
    # Synthetic, opaque fixtures. Never use these predictable tokens in a real institution.
    return "demo_" + digest(f"rapiclinics-fixture-{index}")[:32]


def fixture_pdf(identifier, name):
    stream = io.BytesIO()
    pdf = canvas.Canvas(stream)
    pdf.setTitle("RAPICLINICS - Documento ficticio")
    for y, text in [
        (790, "RAPICLINICS | DATOS FICTICIOS"),
        (750, "Resumen de visita - Simulacion"),
        (710, f"Paciente: {name}"),
        (685, f"Identificador: {identifier}"),
        (645, "Paciente refiere mejoria. Pendiente: revisar hemograma manana."),
        (590, "Documento educativo. No utilizar para decisiones clinicas."),
    ]:
        pdf.drawString(50, y, text)
    pdf.save()
    return stream.getvalue()


def seed(db):
    if os.getenv("APP_MODE", "demo") != "demo":
        raise RuntimeError("Demo seeding is disabled in clinical mode")
    if db.scalar(select(User.id).limit(1)):
        return
    if not db.get(Clinic, "demo"):
        db.add(Clinic(id="demo", name="Clínica de demostración"))
        db.flush()
    password = os.getenv("DEMO_PASSWORD", "RapiDemo2026!")
    password_hash = hasher.hash(password)
    for index, name in enumerate(NAMES):
        role = [
            "PHYSICIAN",
            "NURSE",
            "RESIDENT",
            "STUDENT",
            "RECORDS_ADMIN",
            "INTERN",
            "PHYSICIAN",
            "NURSE",
            "RESIDENT",
            "SYSTEM_ADMIN",
        ][index]
        db.add(
            User(
                email="demo@rapiclinics.app" if index == 0 else f"demo{index + 1}@rapiclinics.app",
                name="Dra. Valentina Ruiz" if index == 0 else f"Profesional Demo {index + 1}",
                password_hash=password_hash,
                role=role,
            )
        )
        patient = Patient(
            name=name,
            identifier=f"SIM-{7314 + index}",
            birth_date=f"{1964 + index}-04-12",
            sex="F" if index % 2 == 0 else "M",
            summary="Seguimiento hospitalario de demostración. Evolución pendiente de revisión durante la ronda.",
            allergies="No documentadas en esta simulación",
        )
        db.add(patient)
        db.flush()
        encounter = Encounter(patient_id=patient.id, service="Medicina interna")
        bed = Bed(code="302-B" if index == 0 else f"{302 + index}-A", unit="Medicina interna")
        db.add_all([encounter, bed])
        db.flush()
        db.add_all(
            [
                Assignment(bed_id=bed.id, encounter_id=encounter.id),
                Tag(bed_id=bed.id, token_hash=digest(fixture_token(index))),
            ]
        )
        for description in ["Revisar resultados disponibles", "Completar registro de ronda"]:
            db.add(Task(patient_id=patient.id, encounter_id=encounter.id, description=description))
    empty = Bed(code="410-A", unit="Medicina interna")
    db.add(empty)
    db.flush()
    db.add_all(
        [
            Tag(bed_id=empty.id, token_hash=digest(fixture_token(10))),
            Tag(bed_id=empty.id, token_hash=digest(fixture_token(11)), status="REVOKED"),
        ]
    )
    db.commit()


if __name__ == "__main__":
    with SessionLocal() as db:
        seed(db)
    if "--write-fixtures" in sys.argv:
        output = Path(__file__).resolve().parents[3] / "fixtures/pdfs"
        output.mkdir(parents=True, exist_ok=True)
        for index, name in enumerate(NAMES):
            (output / f"paciente-{index + 1}.pdf").write_bytes(fixture_pdf(f"SIM-{7314 + index}", name))
