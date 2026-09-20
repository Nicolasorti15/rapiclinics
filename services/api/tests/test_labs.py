import io

import pytest
from reportlab.pdfgen import canvas
from sqlalchemy import select

from app.models import Encounter, LabReport, User


CSV = b"paciente,fecha,variable,valor,unidad\nSIM-7314,2026-09-01,Leucocitos,8.2,10^9/L\nSIM-7314,2026-09-05,Leucocitos,7.1,10^9/L\n"


def upload(client, context, content=CSV, name="hemograma.csv"):
    return client.post(
        f"/patients/{context['patient']['id']}/labs",
        data={"scan_id": context["scan_id"]},
        files={"file": (name, content)},
    )


def confirm(client, context, report, **changes):
    body = {
        "scan_id": context["scan_id"],
        "reviewed": True,
        "identity_manually_checked": True,
        "rows": report["rows"],
        **changes,
    }
    return client.post(f"/labs/{report['id']}/confirm", json=body)


def test_lab_review_original_duplicate_and_immutable_confirmation(client, context):
    result = upload(client, context)
    assert result.status_code == 201, result.text
    report = result.json()
    assert report["status"] == "REVIEW_REQUIRED"
    assert "storage_key" not in report
    assert client.get(f"/labs/{report['id']}/file").content == CSV
    assert upload(client, context).status_code == 409
    result = confirm(client, context, report)
    assert result.status_code == 200, result.text
    assert result.json()["rows"][0]["value"] == 8.2
    assert result.json()["status"] == "CONFIRMED"
    assert confirm(client, context, report).status_code == 409


def test_lab_wrong_patient_cannot_confirm(client, context):
    report = upload(client, context, CSV.replace(b"SIM-7314", b"SIM-9999")).json()
    assert report["identity_status"] == "MISMATCH"
    assert confirm(client, context, report).status_code == 409


@pytest.mark.parametrize(
    "field,value",
    [
        ("value", -1),
        ("value", "NaN"),
        ("value", "<5"),
        ("unit", " "),
        ("analyte", " "),
        ("date", "2026-02-30"),
        ("date", "2099-01-01"),
    ],
)
def test_lab_invalid_values_not_confirmed(client, context, field, value):
    report = upload(client, context).json()
    rows = report["rows"]
    rows[0][field] = value
    assert confirm(client, context, report, rows=rows).status_code == 422
    listed = client.get(f"/patients/{context['patient']['id']}/labs").json()
    assert listed[0]["status"] == "REVIEW_REQUIRED"


def test_lab_unknown_identity_needs_manual_check(client, context):
    report = upload(client, context, CSV.replace(b"SIM-7314", b"Ficticio")).json()
    assert confirm(client, context, report, identity_manually_checked=False).status_code == 422
    assert confirm(client, context, report).status_code == 200


def test_lab_pdf_extraction_and_original(client, context):
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer)
    for y, line in enumerate(
        ["DEMO SIM-7314", "2026-09-12", "Leucocitos: 6.8 10^9/L", "Hemoglobina: 13.1 g/dL"]
    ):
        pdf.drawString(40, 750 - y * 25, line)
    pdf.save()
    report = upload(client, context, buffer.getvalue(), "resultado.pdf").json()
    assert len(report["rows"]) == 2
    assert report["rows"][0]["date"] == "2026-09-12"
    assert client.get(f"/labs/{report['id']}/file").content == buffer.getvalue()
    assert confirm(client, context, report).status_code == 200


def test_lab_cross_unit_read_allowed_but_confirmation_stays_restricted(client, context, db):
    report = upload(client, context).json()
    record = db.get(LabReport, report["id"])
    other = Encounter(
        patient_id=record.patient_id,
        service="Otro servicio",
        status="ENDED",
    )
    db.add(other)
    db.flush()
    record.encounter_id = other.id
    db.commit()

    reports = client.get(f"/patients/{record.patient_id}/labs")
    assert reports.status_code == 200
    assert any(item["id"] == record.id for item in reports.json())

    # El original puede consultarse transversalmente dentro de la clínica.
    assert client.get(f"/labs/{record.id}/file").status_code == 200

    # Confirmarlo sigue siendo una operación de escritura restringida.
    assert confirm(client, context, report).status_code == 404


def test_lab_nonclinical_role_cannot_import(client, context, db):
    user = db.scalar(select(User).where(User.email == "demo@rapiclinics.app"))
    user.role = "RECORDS_ADMIN"
    db.commit()
    assert upload(client, context).status_code == 403
