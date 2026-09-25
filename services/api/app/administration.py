"""Clinic administration; permissions are enforced on every server operation."""

import re
import secrets
from datetime import date
from typing import Literal

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


class InviteStaff(StrictModel):
    email: str
    unit: str = Field(min_length=2, max_length=100)
    role: Literal["PHYSICIAN", "NURSE", "RECORDS_ADMIN"] = "PHYSICIAN"
    _email = field_validator("email")(normalize_email)


class RegisterDoctor(StrictModel):
    token: str = Field(min_length=32, max_length=256)
    email: str
    name: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=8, max_length=128)
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


class NewAdmission(StrictModel):
    service: str = Field(min_length=2, max_length=100)
    bed_code: str = Field(min_length=1, max_length=30)


def admin(user=Depends(get_user)):
    require_role(user, ADMIN_ROLES)
    return user


def owned_patient(db, user, patient_id):
    patient = db.get(Patient, patient_id)
    if not patient or patient.clinic_id != user.clinic_id:
        raise HTTPException(404, "Paciente no encontrado.")
    return patient


def available_bed(db, user, service, bed_code):
    bed = db.scalar(select(Bed).where(Bed.clinic_id == user.clinic_id, Bed.code == bed_code))
    if bed and (
        bed.unit != service
        or db.scalar(select(Assignment.id).where(Assignment.bed_id == bed.id, Assignment.status == "ACTIVE"))
    ):
        raise HTTPException(409, "La cama está ocupada o pertenece a otro servicio.")
    if not bed:
        bed = Bed(clinic_id=user.clinic_id, code=bed_code, unit=service)
        db.add(bed)
        db.flush()
    return bed


def create_admission(db, user, patient, body):
    active = db.scalar(
        select(Encounter.id).where(
            Encounter.patient_id == patient.id,
            Encounter.clinic_id == user.clinic_id,
            Encounter.status == "ACTIVE",
        )
    )
    if active:
        raise HTTPException(409, "El paciente ya tiene un ingreso activo.")
    bed = available_bed(db, user, body.service, body.bed_code)
    encounter = Encounter(clinic_id=user.clinic_id, patient_id=patient.id, service=body.service)
    db.add(encounter)
    db.flush()
    db.add(Assignment(bed_id=bed.id, encounter_id=encounter.id))
    db.flush()
    return encounter


@router.get("/admin/users")
def users(user=Depends(admin), db: Session = Depends(db_session)):
    return [
        {**public_user(db, item), "active": item.active}
        for item in db.scalars(select(User).where(User.clinic_id == user.clinic_id)).all()
    ]


@router.post("/admin/invitations", status_code=201)
def invite(body: InviteStaff, user=Depends(admin), db: Session = Depends(db_session)):
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
        role=body.role,
        token_hash=digest(token),
        expires_at=future(60 * 24),
        created_by=user.id,
    )
    db.add(invitation)
    audit(db, user, "staff_invited", role=body.role)
    db.commit()
    return {
        "token": token,
        "email": body.email,
        "role": body.role,
        "expires_at": invitation.expires_at,
    }


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
            role=invitation.role,
            unit=invitation.unit,
            password_hash=hasher.hash(body.password),
        )
        db.add(user)
        db.flush()
        audit(db, user, "staff_registered", role=user.role)
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
    if target.role in ADMIN_ROLES:
        raise HTTPException(409, "No puedes desactivar una cuenta administradora desde esta opción.")
    target.active = False
    db.execute(update(AuthSession).where(AuthSession.user_id == target.id).values(revoked=True))
    audit(db, user, "user_deactivated", target.id)
    db.commit()
    return {"ok": True}


@router.post("/admin/patients", status_code=201)
def create_patient(body: NewPatient, user=Depends(admin), db: Session = Depends(db_session)):
    from .main import patient_context

    try:
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
        create_admission(db, user, patient, body)
        audit(db, user, "patient_registered", patient.id)
        result = patient_context(db, user, patient.id)
        db.commit()
        return result
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "La cédula ya está registrada o la cama acaba de ser asignada.") from exc


@router.get("/admin/patients/by-identifier/{identifier}")
def patient_by_identifier(identifier: str, user=Depends(admin), db: Session = Depends(db_session)):
    if not re.fullmatch(r"[0-9]{3,15}", identifier):
        raise HTTPException(422, "Introduce una cédula válida, sin puntos.")
    patient = db.scalar(
        select(Patient).where(
            Patient.clinic_id == user.clinic_id,
            Patient.document_type == "CC",
            Patient.identifier == identifier,
        )
    )
    if not patient:
        raise HTTPException(404, "La cédula no está registrada en esta clínica.")
    encounters = db.scalars(
        select(Encounter)
        .where(Encounter.clinic_id == user.clinic_id, Encounter.patient_id == patient.id)
        .order_by(Encounter.admission_at.desc())
    ).all()
    active = next((encounter for encounter in encounters if encounter.status == "ACTIVE"), None)
    current = None
    if active:
        from .main import patient_context

        current = patient_context(db, user, patient.id)
    audit(db, user, "patient_lookup", patient.id)
    db.commit()
    return {
        "patient": {
            "id": patient.id,
            "name": patient.name,
            "identifier": patient.identifier,
            "birth_date": patient.birth_date,
            "sex": patient.sex,
            "summary": patient.summary,
            "allergies": patient.allergies,
        },
        "active": active is not None,
        "current": current,
        "last_discharge_at": next(
            (encounter.discharged_at for encounter in encounters if encounter.discharged_at), None
        ),
    }


@router.post("/admin/patients/{patient_id}/admit", status_code=201)
def admit_patient(
    patient_id: str,
    body: NewAdmission,
    user=Depends(admin),
    db: Session = Depends(db_session),
):
    from .main import patient_context

    patient = owned_patient(db, user, patient_id)
    try:
        encounter = create_admission(db, user, patient, body)
        audit(db, user, "patient_readmitted", patient.id, encounter_id=encounter.id)
        result = patient_context(db, user, patient.id)
        db.commit()
        return result
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "El paciente ya fue ingresado o la cama acaba de ocuparse.") from exc


@router.post("/admin/patients/{patient_id}/discharge")
def discharge_patient(patient_id: str, user=Depends(admin), db: Session = Depends(db_session)):
    patient = owned_patient(db, user, patient_id)
    encounter = db.scalar(
        select(Encounter).where(
            Encounter.patient_id == patient.id,
            Encounter.clinic_id == user.clinic_id,
            Encounter.status == "ACTIVE",
        )
    )
    if not encounter:
        raise HTTPException(409, "El paciente no tiene un ingreso activo.")
    discharged_at = now()
    changed = db.execute(
        update(Encounter)
        .where(Encounter.id == encounter.id, Encounter.status == "ACTIVE")
        .values(status="DISCHARGED", discharged_at=discharged_at)
    )
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "El ingreso cambió. Actualiza la lista e inténtalo nuevamente.")
    db.execute(
        update(Assignment)
        .where(Assignment.encounter_id == encounter.id, Assignment.status == "ACTIVE")
        .values(status="ENDED", ended_at=discharged_at)
    )
    db.execute(
        update(Tag)
        .where(Tag.patient_id == patient.id, Tag.status.in_(["ACTIVE", "PENDING"]))
        .values(status="REVOKED")
    )
    audit(db, user, "patient_discharged", patient.id, encounter_id=encounter.id)
    db.commit()
    return {"patient_id": patient.id, "status": "DISCHARGED", "discharged_at": discharged_at}


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
