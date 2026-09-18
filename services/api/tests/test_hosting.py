import pytest
from sqlalchemy import select

from app.models import Clinic, User
from app.security import hasher
from app.settings import database_url
from app.start_server import bootstrap_clinic


@pytest.mark.parametrize("scheme", ["postgres", "postgresql", "postgresql+psycopg"])
def test_hosted_database_driver(scheme):
    assert database_url(f"{scheme}://u:p%40ss@host/db?sslmode=require") == (
        "postgresql+psycopg://u:p%40ss@host/db?sslmode=require"
    )


def test_sqlite_unchanged():
    assert database_url("sqlite:///test.db") == "sqlite:///test.db"


def test_bootstrap_requires_operator_credentials(db):
    with pytest.raises(RuntimeError, match="Configure all"):
        bootstrap_clinic(db, {})
    assert db.scalar(select(Clinic.id).where(Clinic.id != "demo")) is None


def test_bootstrap_preserves_admin_on_restart(db):
    env = {
        "INITIAL_CLINIC_NAME": "Pruebas",
        "INITIAL_ADMIN_EMAIL": "admin@example.test",
        "INITIAL_ADMIN_NAME": "Admin",
        "INITIAL_ADMIN_PASSWORD": "UnaClaveDePruebas2026!",
    }
    assert bootstrap_clinic(db, env)
    admin = db.scalar(select(User).where(User.email == env["INITIAL_ADMIN_EMAIL"]))
    assert admin.role == "ADMIN"
    assert hasher.verify(admin.password_hash, env["INITIAL_ADMIN_PASSWORD"])
    original_hash = admin.password_hash
    assert not bootstrap_clinic(db, {**env, "INITIAL_ADMIN_PASSWORD": "OtraClaveNoAplicada!"})
    assert not bootstrap_clinic(db, {})
    db.refresh(admin)
    assert admin.password_hash == original_hash


def test_bootstrap_rejects_weak_password(db):
    with pytest.raises(ValueError):
        bootstrap_clinic(
            db,
            {
                "INITIAL_CLINIC_NAME": "Pruebas",
                "INITIAL_ADMIN_NAME": "Admin",
                "INITIAL_ADMIN_EMAIL": "admin@example.test",
                "INITIAL_ADMIN_PASSWORD": "short",
            },
        )
    assert db.scalar(select(Clinic.id).where(Clinic.id != "demo")) is None
