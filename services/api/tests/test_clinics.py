import pytest
from sqlalchemy import select

from app.create_clinic import create_clinic
from app.models import Assignment, Encounter, Patient, Tag
from app.providers import identity_match
from app.security import digest


@pytest.fixture
def clinics(client, db):
    first = create_clinic(
        db, "Clínica A", "clinica-a.test", "admin@clinica-a.test", "Admin A", "ClaveSegura2026!"
    )
    second = create_clinic(
        db, "Clínica B", "clinica-b.test", "admin@clinica-b.test", "Admin B", "ClaveSegura2026!"
    )
    return first, second


def login(client, email):
    response = client.post("/auth/login", json={"email": email, "password": "ClaveSegura2026!"})
    assert response.status_code == 200
    client.headers["Authorization"] = "Bearer " + response.json()["access_token"]
    return response.json()


def patient_data():
    return {
        "name": "Paciente de prueba",
        "identifier": "123456789",
        "birth_date": "1990-01-01",
        "sex": "F",
        "service": "Medicina interna",
        "bed_code": "101",
    }


def doctor(client):
    result = client.post(
        "/admin/invitations", json={"email": "medico@clinica-a.test", "unit": "Medicina interna"}
    )
    assert result.status_code == 201
    body = {
        "token": result.json()["token"],
        "email": "medico@clinica-a.test",
        "name": "Médica Uno",
        "password": "ClaveSegura2026!",
    }
    response = client.post("/auth/register", json=body)
    assert response.status_code == 201
    return body, response.json()


def test_invitation_cannot_grant_admin_and_is_single_use(client, clinics):
    login(client, "admin@clinica-a.test")
    assert (
        client.post(
            "/admin/invitations", json={"email": "otro@personal.test", "unit": "Medicina interna"}
        ).status_code
        == 422
    )
    invitation, session = doctor(client)
    assert session["user"]["role"] == "PHYSICIAN"
    assert session["user"]["clinic_id"] == clinics[0].id
    assert client.post("/auth/register", json=invitation).status_code == 400
    assert client.post("/auth/register", json={**invitation, "role": "ADMIN"}).status_code == 422


def test_doctor_can_register_and_login_with_eight_letters(client, clinics):
    login(client, "admin@clinica-a.test")
    invitation = client.post(
        "/admin/invitations", json={"email": "medico@clinica-a.test", "unit": "Medicina interna"}
    ).json()
    body = {
        "token": invitation["token"],
        "email": "medico@clinica-a.test",
        "name": "Medico de prueba",
        "password": "abcdefg",
    }
    assert client.post("/auth/register", json=body).status_code == 422
    body["password"] = "abcdefgh"
    response = client.post("/auth/register", json=body)
    assert response.status_code == 201
    assert response.json()["user"]["role"] == "PHYSICIAN"
    client.headers.pop("Authorization", None)
    assert (
        client.post("/auth/login", json={"email": body["email"], "password": body["password"]}).status_code
        == 200
    )


def test_clinic_boundaries_and_admin_only_nfc(client, db, clinics):
    login(client, "admin@clinica-a.test")
    patient = client.post("/admin/patients", json=patient_data()).json()
    assert patient["identifier"] == "123456789"
    duplicate = {**patient_data(), "bed_code": "102"}
    assert client.post("/admin/patients", json=duplicate).status_code == 409
    assert len(db.scalars(select(Patient).where(Patient.clinic_id == clinics[0].id)).all()) == 1
    prepared = client.post(f"/admin/patients/{patient['id']}/nfc/prepare").json()
    token = prepared["token"]
    assert patient["identifier"] not in token
    assert db.scalar(select(Tag).where(Tag.token_hash == digest(token))).status == "PENDING"
    assert client.post("/nfc/resolve", json={"token": token}).status_code == 404
    assert (
        client.post(f"/admin/patients/{patient['id']}/nfc/activate", json={"token": token}).status_code == 200
    )
    assert client.post("/nfc/resolve", json={"token": token}).json()["patient"]["id"] == patient["id"]
    _, session = doctor(client)
    client.headers["Authorization"] = "Bearer " + session["access_token"]
    assert client.get("/patients").json()[0]["id"] == patient["id"]
    assert client.post("/nfc/resolve", json={"token": token}).status_code == 200
    assert client.post("/admin/patients", json=duplicate).status_code == 403
    for action in ["prepare", "revoke"]:
        assert client.post(f"/admin/patients/{patient['id']}/nfc/{action}").status_code == 403
    assert (
        client.post(f"/admin/patients/{patient['id']}/nfc/activate", json={"token": token}).status_code == 403
    )
    login(client, "admin@clinica-b.test")
    assert client.get("/patients").json() == []
    assert client.get(f"/patients/{patient['id']}").status_code == 404
    assert client.post("/nfc/resolve", json={"token": token}).status_code == 404
    assert client.post(f"/admin/patients/{patient['id']}/nfc/prepare").status_code == 404
    # The same national ID and bed code may exist in another clinic without exposing any history.
    other = client.post("/admin/patients", json=patient_data())
    assert other.status_code == 201
    assert other.json()["id"] != patient["id"]
    assert client.get("/tasks").json() == []


def test_revoked_tag_invalidates_existing_scan(client, clinics):
    login(client, "admin@clinica-a.test")
    p = client.post("/admin/patients", json=patient_data()).json()
    token = client.post(f"/admin/patients/{p['id']}/nfc/prepare").json()["token"]
    client.post(f"/admin/patients/{p['id']}/nfc/activate", json={"token": token})
    scan = client.post("/nfc/resolve", json={"token": token}).json()
    client.post(f"/admin/patients/{p['id']}/nfc/revoke")
    assert (
        client.post(
            f"/nfc/scans/{scan['scan_id']}/confirm", json={"confirmed_patient_id": p["id"]}
        ).status_code
        == 409
    )


def test_discharge_preserves_patient_and_allows_readmission_by_identifier(client, db, clinics):
    login(client, "admin@clinica-a.test")
    patient = client.post("/admin/patients", json=patient_data()).json()
    original_encounter = patient["encounter_id"]
    token = client.post(f"/admin/patients/{patient['id']}/nfc/prepare").json()["token"]
    client.post(f"/admin/patients/{patient['id']}/nfc/activate", json={"token": token})

    discharged = client.post(f"/admin/patients/{patient['id']}/discharge")
    assert discharged.status_code == 200
    assert discharged.json()["status"] == "DISCHARGED"
    assert discharged.json()["discharged_at"]
    assert client.get("/patients").json() == []
    assert db.get(Patient, patient["id"]) is not None
    old_encounter = db.get(Encounter, original_encounter)
    assert old_encounter.status == "DISCHARGED"
    assert old_encounter.discharged_at == discharged.json()["discharged_at"]
    assignment = db.scalar(select(Assignment).where(Assignment.encounter_id == original_encounter))
    assert assignment.status == "ENDED"
    assert assignment.ended_at == discharged.json()["discharged_at"]
    assert db.scalar(select(Tag).where(Tag.token_hash == digest(token))).status == "REVOKED"

    lookup = client.get("/admin/patients/by-identifier/123456789")
    assert lookup.status_code == 200
    assert lookup.json()["patient"]["id"] == patient["id"]
    assert lookup.json()["active"] is False
    assert lookup.json()["last_discharge_at"] == discharged.json()["discharged_at"]

    readmitted = client.post(
        f"/admin/patients/{patient['id']}/admit",
        json={"service": "Medicina interna", "bed_code": "205"},
    )
    assert readmitted.status_code == 201
    assert readmitted.json()["id"] == patient["id"]
    assert readmitted.json()["encounter_id"] != original_encounter
    assert readmitted.json()["bed"] == "205"
    assert len(db.scalars(select(Patient).where(Patient.id == patient["id"])).all()) == 1
    assert (
        client.post(
            f"/admin/patients/{patient['id']}/admit",
            json={"service": "Medicina interna", "bed_code": "206"},
        ).status_code
        == 409
    )


def test_only_admin_can_lookup_readmit_or_discharge_patients(client, clinics):
    admin_session = login(client, "admin@clinica-a.test")
    patient = client.post("/admin/patients", json=patient_data()).json()
    _, physician_session = doctor(client)
    client.headers["Authorization"] = "Bearer " + physician_session["access_token"]
    assert client.get("/admin/patients/by-identifier/123456789").status_code == 403
    assert client.post(f"/admin/patients/{patient['id']}/discharge").status_code == 403
    assert (
        client.post(
            f"/admin/patients/{patient['id']}/admit",
            json={"service": "Medicina interna", "bed_code": "205"},
        ).status_code
        == 403
    )
    client.headers["Authorization"] = "Bearer " + admin_session["access_token"]
    assert client.get("/patients").status_code == 200


def test_deactivated_doctor_loses_existing_session(client, clinics):
    admin = login(client, "admin@clinica-a.test")
    _, session = doctor(client)
    client.post(f"/admin/users/{session['user']['id']}/deactivate")
    client.headers["Authorization"] = "Bearer " + session["access_token"]
    assert client.get("/patients").status_code == 401
    assert client.post("/auth/refresh", json={"refresh_token": session["refresh_token"]}).status_code == 401
    client.headers["Authorization"] = "Bearer " + admin["access_token"]
    assert client.get("/patients").status_code == 200


def test_clinical_mode_disables_demo_identity_and_accounts(client, clinics, monkeypatch):
    login(client, "admin@clinica-a.test")
    monkeypatch.setenv("APP_MODE", "clinical")
    assert client.post("/demo/patients/anything/identify").status_code == 404
    assert (
        client.post(
            "/auth/login", json={"email": "demo@rapiclinics.app", "password": "RapiDemo2026!"}
        ).status_code
        == 401
    )


def test_cedula_extraction_ignores_unlabelled_values():
    assert identity_match("Cédula: 1.234.567\nGlóbulos blancos 12000", "1234567")[0] == "MATCH"
    assert identity_match("CC: 987654321\nHemoglobina 14", "1234567")[0] == "MISMATCH"
    assert identity_match("Glóbulos blancos 12000", "12000")[0] == "NO_IDENTIFIERS"


def test_clinical_attachments_are_encrypted_and_transactional(db, monkeypatch):
    from app.models import StoredObject
    from app.storage import ObjectStorage

    monkeypatch.setenv("APP_MODE", "clinical")
    storage = ObjectStorage()
    content = b"synthetic clinical attachment"
    storage.put("synthetic-attachment", content, db=db)
    stored = db.get(StoredObject, "synthetic-attachment")
    assert stored.encrypted_content != content
    assert storage.cipher.decrypt(stored.encrypted_content) == content
    db.rollback()
    assert db.get(StoredObject, "synthetic-attachment") is None


def test_clinical_deployment_rejects_missing_configuration(monkeypatch):
    from app.settings import validate_deployment

    monkeypatch.setenv("APP_MODE", "clinical")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///test.db")
    with pytest.raises(RuntimeError, match="PostgreSQL"):
        validate_deployment()
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://example.invalid/db")
    monkeypatch.delenv("STORAGE_ENCRYPTION_KEY", raising=False)
    with pytest.raises(RuntimeError, match="STORAGE_ENCRYPTION_KEY"):
        validate_deployment()
    monkeypatch.setenv("STORAGE_ENCRYPTION_KEY", "placeholder")
    monkeypatch.setenv("PUBLIC_API_URL", "http://example.invalid")
    with pytest.raises(RuntimeError, match="HTTPS"):
        validate_deployment()
