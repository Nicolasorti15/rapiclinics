"""Container entry point, including first-clinic setup for hosts without a shell."""

import os
import subprocess
import sys

from .settings import validate_deployment


def bootstrap_clinic(db, env):
    from sqlalchemy import select

    from .create_clinic import create_clinic
    from .models import Clinic

    # Never reset credentials or create another clinic on a restart.
    if db.scalar(select(Clinic.id).where(Clinic.id != "demo").limit(1)):
        return False
    required = ("INITIAL_CLINIC_NAME", "INITIAL_ADMIN_EMAIL", "INITIAL_ADMIN_NAME", "INITIAL_ADMIN_PASSWORD")
    if not all(env.get(key, "").strip() for key in required):
        raise RuntimeError("Configure all INITIAL_CLINIC_NAME and INITIAL_ADMIN_* bootstrap fields")
    create_clinic(
        db,
        env["INITIAL_CLINIC_NAME"],
        env.get("INITIAL_EMAIL_DOMAIN", ""),
        env["INITIAL_ADMIN_EMAIL"],
        env["INITIAL_ADMIN_NAME"],
        env["INITIAL_ADMIN_PASSWORD"],
    )
    return True


def main():
    if not os.getenv("PUBLIC_API_URL") and os.getenv("RENDER_EXTERNAL_URL"):
        os.environ["PUBLIC_API_URL"] = os.environ["RENDER_EXTERNAL_URL"]
    validate_deployment()
    # Validate encryption before touching the database.
    if os.getenv("APP_MODE", "demo") == "clinical":
        from cryptography.fernet import Fernet

        Fernet(os.environ["STORAGE_ENCRYPTION_KEY"])
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
    if os.getenv("APP_MODE", "demo") == "demo":
        subprocess.run([sys.executable, "-m", "app.seed"], check=True)
    else:
        from .db import SessionLocal

        with SessionLocal() as db:
            bootstrap_clinic(db, os.environ)
    # Do not pass the bootstrap password to the long-running API process.
    os.environ.pop("INITIAL_ADMIN_PASSWORD", None)
    os.execvp(
        sys.executable,
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            os.getenv("PORT", "8000"),
            "--no-access-log",
        ],
    )


if __name__ == "__main__":
    main()
