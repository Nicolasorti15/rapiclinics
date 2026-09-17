import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import db_session, now
from .models import Audit, AuthSession, Encounter, User

hasher = PasswordHasher()
bearer = HTTPBearer(auto_error=False)
CLINICAL_ROLES = {"STUDENT", "INTERN", "RESIDENT", "PHYSICIAN", "NURSE", "SYSTEM_ADMIN"}
DOCUMENT_ROLES = CLINICAL_ROLES | {"RECORDS_ADMIN"}


def digest(value: str):
    return hashlib.sha256(value.encode()).hexdigest()


def future(minutes: int):
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()


def audit(db, user, action, entity_id=None, **details):
    db.add(Audit(user_id=user.id if user else None, action=action, entity_id=entity_id, details=details))


def issue_session(db, user):
    access, refresh = secrets.token_urlsafe(32), secrets.token_urlsafe(48)
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=digest(access),
            refresh_hash=digest(refresh),
            expires_at=future(15),
            refresh_expires_at=future(60 * 24 * 7),
        )
    )
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": 900,
        "user": {"id": user.id, "name": user.name, "role": user.role, "email": user.email},
    }


def get_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(db_session)
):
    if not credentials:
        raise HTTPException(401, "Inicia sesión para continuar.")
    session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_hash == digest(credentials.credentials),
            AuthSession.revoked.is_(False),
            AuthSession.expires_at > now(),
        )
    )
    user = db.get(User, session.user_id) if session else None
    if not user or not user.active:
        raise HTTPException(401, "Tu sesión ha caducado. Inicia sesión de nuevo.")
    return user


def require_role(user, allowed):
    if user.role not in allowed:
        raise HTTPException(403, "Tu rol no permite esta acción.")


def encounter_access(db, user, encounter_id):
    encounter = db.get(Encounter, encounter_id)
    if not encounter or (user.role != "SYSTEM_ADMIN" and encounter.service != user.unit):
        raise HTTPException(404, "No se encontró el episodio autorizado.")
    return encounter
