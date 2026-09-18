"""Clinic administration; permissions are enforced on every server operation."""

import re
import secrets
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import db_session, now
from .models import Assignment, AuthSession, Bed, Clinic, Encounter, Invitation, Patient, Tag, User
from .schemas import StrictModel, Resolve
from .security import (
    ADMIN_ROLES,
    audit,
    clinic_active,
    digest,
    future,
    get_user,
    hasher,
    issue_session,
    public_user,
    require_role,
)

router = APIRouter()


def normalize_email(value):
    value = value.strip().lower()
    if len(value) > 254 or not re.fullmatch(r"[^\s@]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}", value):
        raise ValueError("Introduce un correo válido.")
    return value


class InviteDoctor(StrictModel):
    email: str
    unit: str = Field(min_length=2, max_length=100)
    _email = field_validator("email")(normalize_email)


class RegisterDoctor(StrictModel):
    token: str = Field(min_length=32, max_length=256)
    email: str
    name: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=12, max_length=128)
    _email = field_validator("email")(normalize_email)


class NewPatient(StrictModel):
    name: str = Field(min_length=3, max_length=160)
    identifier: str = Field(pattern=r"^[0-9]{3,15}$")
    birth_date: date
    sex: str = Field(pattern=r"^(F|M|X|ND)$")
    service: str = Field(min_length=2, max_length=100)
    bed_code: str = Field(min_length=1, max_length=30)
    summary: str = Field(default="", max_length=20000)
    allergies: str = Field(default="Sin información registrada", max_length=2000)

    @field_validator("birth_date")
    @classmethod
    def past_birth(cls, value):
        if value > date.today() or value.year < 1900:
            raise ValueError("Revisa la fecha de nacimiento.")
        return value


def admin(user=Depends(get_user)):
    require_role(user, ADMIN_ROLES)
    return user


def owned_patient(db, user, patient_id):
    patient = db.get(Patient, patient_id)
    if not patient or patient.clinic_id != user.clinic_id:
        raise HTTPException(404, "Paciente no encontrado.")
    return patient


@router.get("/admin/users")
def users(user=Depends(admin), db: Session = Depends(db_session)):
    return [
        {**public_user(db, item), "active": item.active}
        for item in db.scalars(select(User).where(User.clinic_id == user.clinic_id)).all()
    ]


@router.post("/admin/invitations", status_code=201)
def invite(body: InviteDoctor, user=Depends(admin), db: Session = Depends(db_session)):
    clinic = db.get(Clinic, user.clinic_id)
    if clinic.email_domain and body.email.split("@")[-1] != clinic.email_domain:
        raise HTTPException(422, "Utiliza el correo laboral del dominio de la clínica.")
    if db.scalar(select(User.id).where(User.email == body.email)):
        raise HTTPException(409, "No se puede invitar esta cuenta; revisa su alta con el administrador.")
    # Supersede older unused invitations for this clinic/email.
    db.execute(
        update(Invitation)
        .where(Invitation.clinic_id == user.clinic_id, Invitation.email == body.email)
        .values(used=True)
    )
    token = secrets.token_urlsafe(32)
    invitation = Invitation(
        clinic_id=user.clinic_id,
        email=body.email,
        unit=body.unit,
        token_hash=digest(token),
        expires_at=future(60 * 24),
        created_by=user.id,
    )
    db.add(invitation)
    audit(db, user, "doctor_invited")
    db.commit()
    return {"token": token, "email": body.email, "expires_at": invitation.expires_at}


@router.post("/auth/register", status_code=201)
def register(body: RegisterDoctor, db: Session = Depends(db_session)):
    invitation = db.scalar(
        select(Invitation).where(
            Invitation.token_hash == digest(body.token),
            Invitation.email == body.email,
            Invitation.used.is_(False),
            Invitation.expires_at > now(),
        )
    )
    clinic = db.get(Clinic, invitation.clinic_id) if invitation else None
    issuer = db.get(User, invitation.created_by) if invitation else None
    if (
        not clinic
        or not clinic.active
        or not issuer
        or not clinic_active(db, issuer)
        or not issuer.active
        or issuer.role not in ADMIN_ROLES
    ):
        raise HTTPException(400, "Invitación no válida o caducada.")
    try:
        changed = db.execute(
            update(Invitation)
            .where(Invitation.id == invitation.id, Invitation.used.is_(False))
            .values(used=True)
        )
        if changed.rowcount != 1:
            raise HTTPException(409, "Esta invitación ya fue utilizada.")
        user = User(
            clinic_id=clinic.id,
            email=body.email,
            name=body.name,
            role="PHYSICIAN",
            unit=invitation.unit,
            password_hash=hasher.hash(body.password),
        )
        db.add(user)
        db.flush()
        audit(db, user, "doctor_registered")
        result = issue_session(db, user)
        db.commit()
        return result
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "No se puede completar el registro de esta cuenta.") from exc


@router.post("/admin/users/{user_id}/deactivate")
def deactivate(user_id: str, user=Depends(admin), db: Session = Depends(db_session)):
    target = db.get(User, user_id)
    if not target or target.clinic_id != user.clinic_id:
        raise HTTPException(404, "Usuario no encontrado.")
    if target.role != "PHYSICIAN":
        raise HTTPException(409, "Esta opción solo desactiva médicos.")
    target.active = False
    db.execute(update(AuthSession).where(AuthSession.user_id == target.id).values(revoked=True))
    audit(db, user, "user_deactivated", target.id)
    db.commit()
    return {"ok": True}


@router.post("/admin/patients", status_code=201)
def create_patient(body: NewPatient, user=Depends(admin), db: Session = Depends(db_session)):
    from .main import patient_context

    try:
        bed = db.scalar(select(Bed).where(Bed.clinic_id == user.clinic_id, Bed.code == body.bed_code))
        if bed and (
            bed.unit != body.service
            or db.scalar(
                select(Assignment.id).where(Assignment.bed_id == bed.id, Assignment.status == "ACTIVE")
            )
        ):
            raise HTTPException(409, "La cama está ocupada o pertenece a otro servicio.")
        if not bed:
            bed = Bed(clinic_id=user.clinic_id, code=body.bed_code, unit=body.service)
            db.add(bed)
        patient = Patient(
            clinic_id=user.clinic_id,
            document_type="CC",
            name=body.name,
            identifier=body.identifier,
            birth_date=body.birth_date.isoformat(),
            sex=body.sex,
            summary=body.summary,
            allergies=body.allergies,
        )
        db.add(patient)
        db.flush()
        encounter = Encounter(clinic_id=user.clinic_id, patient_id=patient.id, service=body.service)
        db.add(encounter)
        db.flush()
        db.add(Assignment(bed_id=bed.id, encounter_id=encounter.id))
        db.flush()
        audit(db, user, "patient_registered", patient.id)
        result = patient_context(db, user, patient.id)
        db.commit()
        return result
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "La cédula ya está registrada o la cama acaba de ser asignada.") from exc


@router.post("/admin/patients/{patient_id}/nfc/prepare", status_code=201)
def prepare_tag(patient_id: str, user=Depends(admin), db: Session = Depends(db_session)):
    owned_patient(db, user, patient_id)
    db.execute(
        update(Tag).where(Tag.patient_id == patient_id, Tag.status == "PENDING").values(status="REVOKED")
    )
    token = "rc_" + secrets.token_urlsafe(32)
    tag = Tag(patient_id=patient_id, token_hash=digest(token), status="PENDING")
    db.add(tag)
    db.flush()
    audit(db, user, "nfc_prepared", tag.id)
    db.commit()
    return {"tag_id": tag.id, "token": token}


@router.post("/admin/patients/{patient_id}/nfc/activate")
def activate_tag(patient_id: str, body: Resolve, user=Depends(admin), db: Session = Depends(db_session)):
    owned_patient(db, user, patient_id)
    tag = db.scalar(select(Tag).where(Tag.patient_id == patient_id, Tag.token_hash == digest(body.token)))
    if not tag or tag.status not in {"PENDING", "ACTIVE"}:
        raise HTTPException(409, "La etiqueta no corresponde al paciente o fue revocada.")
    db.execute(
        update(Tag)
        .where(Tag.patient_id == patient_id, Tag.id != tag.id, Tag.status.in_(["ACTIVE", "PENDING"]))
        .values(status="REVOKED")
    )
    tag.status = "ACTIVE"
    audit(db, user, "nfc_activated", tag.id)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "La etiqueta cambió durante la operación. Vuelve a vincularla.") from exc
    return {"ok": True}


@router.post("/admin/patients/{patient_id}/nfc/revoke")
def revoke_tag(patient_id: str, user=Depends(admin), db: Session = Depends(db_session)):
    owned_patient(db, user, patient_id)
    db.execute(update(Tag).where(Tag.patient_id == patient_id).values(status="REVOKED"))
    audit(db, user, "patient_nfc_revoked", patient_id)
    db.commit()
    return {"ok": True}
