import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base, db_session
from app.main import app, rate_buckets
from app.seed import seed

root = Path(tempfile.mkdtemp(prefix="rapiclinics-tests-"))
os.environ["STORAGE_PATH"] = str(root / "objects")
os.environ["APP_ENV"] = "development"


@pytest.fixture
def db():
    engine = create_engine(f"sqlite:///{root / 'test.db'}", connect_args={"check_same_thread": False})
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as session:
        seed(session)
        yield session
    engine.dispose()


@pytest.fixture
def client(db):
    app.dependency_overrides[db_session] = lambda: db
    rate_buckets.clear()
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def auth(client):
    result = client.post("/auth/login", json={"email": "demo@rapiclinics.app", "password": "RapiDemo2026!"})
    assert result.status_code == 200
    session = result.json()
    client.headers["Authorization"] = f"Bearer {session['access_token']}"
    return session


@pytest.fixture
def context(client, auth):
    patients = client.get("/patients").json()
    patient = next(patient for patient in patients if patient["identifier"] == "SIM-7314")
    scan = client.post(f"/demo/patients/{patient['id']}/identify").json()
    response = client.post(
        f"/nfc/scans/{scan['scan_id']}/confirm", json={"confirmed_patient_id": patient["id"]}
    )
    assert response.status_code == 200
    return scan
