from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    text,
)

from .db import Base, now, uid


class Clinic(Base):
    __tablename__ = "clinics"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String, nullable=False)
    email_domain = Column(String, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(String, default=now, nullable=False)


class Invitation(Base):
    __tablename__ = "invitations"
    id = Column(String, primary_key=True, default=uid)
    clinic_id = Column(ForeignKey("clinics.id"), nullable=False)
    email = Column(String, nullable=False)
    unit = Column(String, nullable=False)
    role = Column(String, nullable=False, default="PHYSICIAN")
    token_hash = Column(String, unique=True, nullable=False)
    expires_at = Column(String, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_by = Column(ForeignKey("users.id"), nullable=False)


class StoredObject(Base):
    __tablename__ = "stored_objects"
    id = Column(String, primary_key=True)
    encrypted_content = Column(LargeBinary, nullable=False)


class LabReport(Base):
    __tablename__ = "lab_reports"
    id = Column(String, primary_key=True, default=uid)
    patient_id = Column(ForeignKey("patients.id"), nullable=False)
    encounter_id = Column(ForeignKey("encounters.id"), nullable=False)
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    storage_key = Column(String, nullable=False)
    sha256 = Column(String, nullable=False)
    extracted_text = Column(Text, nullable=False)
    identity_status = Column(String, nullable=False)
    rows = Column(JSON, default=list, nullable=False)
    status = Column(String, default="REVIEW_REQUIRED", nullable=False)
    created_at = Column(String, default=now, nullable=False)
    validated_by = Column(ForeignKey("users.id"))
    __table_args__ = (UniqueConstraint("patient_id", "sha256", name="uq_lab_patient_hash"),)


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=uid)
    clinic_id = Column(ForeignKey("clinics.id"), nullable=False, default="demo")
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    unit = Column(String, default="Medicina interna", nullable=False)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    id = Column(String, primary_key=True, default=uid)
    user_id = Column(ForeignKey("users.id"), nullable=False)
    token_hash = Column(String, unique=True, nullable=False)
    refresh_hash = Column(String, unique=True, nullable=False)
    expires_at = Column(String, nullable=False)
    refresh_expires_at = Column(String, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)


class Patient(Base):
    __tablename__ = "patients"
    id = Column(String, primary_key=True, default=uid)
    clinic_id = Column(ForeignKey("clinics.id"), nullable=False, default="demo")
    document_type = Column(String, nullable=False, default="CC")
    name = Column(String, nullable=False)
    identifier = Column(String, nullable=False)
    birth_date = Column(String, nullable=False)
    sex = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    allergies = Column(String, nullable=False)
    __table_args__ = (
        UniqueConstraint("clinic_id", "document_type", "identifier", name="uq_patient_clinic_document"),
    )


class Encounter(Base):
    __tablename__ = "encounters"
    id = Column(String, primary_key=True, default=uid)
    clinic_id = Column(ForeignKey("clinics.id"), nullable=False, default="demo")
    patient_id = Column(ForeignKey("patients.id"), nullable=False)
    service = Column(String, nullable=False)
    status = Column(String, default="ACTIVE", nullable=False)
    admission_at = Column(String, default=now, nullable=False)
    discharged_at = Column(String)
    __table_args__ = (
        UniqueConstraint("id", "patient_id", name="encounter_patient_pair"),
        Index(
            "one_active_patient_encounter",
            "patient_id",
            unique=True,
            sqlite_where=text("status = 'ACTIVE'"),
            postgresql_where=text("status = 'ACTIVE'"),
        ),
    )


class Bed(Base):
    __tablename__ = "beds"
    id = Column(String, primary_key=True, default=uid)
    clinic_id = Column(ForeignKey("clinics.id"), nullable=False, default="demo")
    code = Column(String, nullable=False)
    unit = Column(String, nullable=False)
    __table_args__ = (UniqueConstraint("clinic_id", "code", name="uq_bed_clinic_code"),)


class Assignment(Base):
    __tablename__ = "assignments"
    id = Column(String, primary_key=True, default=uid)
    bed_id = Column(ForeignKey("beds.id"), nullable=False)
    encounter_id = Column(ForeignKey("encounters.id"), nullable=False)
    status = Column(String, default="ACTIVE", nullable=False)
    started_at = Column(String, default=now, nullable=False)
    ended_at = Column(String)
    __table_args__ = (
        Index(
            "one_active_bed",
            "bed_id",
            unique=True,
            sqlite_where=text("status = 'ACTIVE'"),
            postgresql_where=text("status = 'ACTIVE'"),
        ),
        Index(
            "one_active_encounter",
            "encounter_id",
            unique=True,
            sqlite_where=text("status = 'ACTIVE'"),
            postgresql_where=text("status = 'ACTIVE'"),
        ),
    )


class Tag(Base):
    __tablename__ = "tags"
    id = Column(String, primary_key=True, default=uid)
    bed_id = Column(ForeignKey("beds.id"), nullable=True)
    patient_id = Column(ForeignKey("patients.id"), nullable=True)
    token_hash = Column(String, unique=True, nullable=False)
    status = Column(String, default="ACTIVE", nullable=False)
    __table_args__ = (
        CheckConstraint(
            "(bed_id IS NOT NULL AND patient_id IS NULL) OR (bed_id IS NULL AND patient_id IS NOT NULL)",
            name="tag_single_target",
        ),
        Index(
            "one_active_patient_tag",
            "patient_id",
            unique=True,
            sqlite_where=text("status = 'ACTIVE'"),
            postgresql_where=text("status = 'ACTIVE'"),
        ),
    )


class Scan(Base):
    __tablename__ = "scans"
    id = Column(String, primary_key=True, default=uid)
    user_id = Column(ForeignKey("users.id"), nullable=False)
    assignment_id = Column(ForeignKey("assignments.id"), nullable=False)
    tag_id = Column(ForeignKey("tags.id"))
    patient_id = Column(ForeignKey("patients.id"), nullable=False)
    confirmed = Column(Boolean, default=False, nullable=False)
    expires_at = Column(String, nullable=False)


class Visit(Base):
    __tablename__ = "visits"
    id = Column(String, primary_key=True, default=uid)
    encounter_id = Column(ForeignKey("encounters.id"), nullable=False)
    patient_id = Column(ForeignKey("patients.id"), nullable=False)
    scan_id = Column(ForeignKey("scans.id"), nullable=False)
    created_by = Column(ForeignKey("users.id"), nullable=False)
    status = Column(String, default="DRAFT", nullable=False)
    transcript = Column(Text, default="", nullable=False)
    original_transcript = Column(Text, default="", server_default="", nullable=False)
    note = Column(JSON, default=dict, nullable=False)
    audio_key = Column(String)
    created_at = Column(String, default=now, nullable=False)
    confirmed_at = Column(String)
    validated_by = Column(ForeignKey("users.id"))
    provider = Column(String, default="extractive-demo", nullable=False)
    model_version = Column(String, default="1.0.0", nullable=False)
    prompt_version = Column(String, default="literal-v1", nullable=False)
    __table_args__ = (
        ForeignKeyConstraint(
            ["encounter_id", "patient_id"],
            ["encounters.id", "encounters.patient_id"],
            name="visit_encounter_patient",
        ),
        CheckConstraint(
            "status != 'CONFIRMED' OR (validated_by IS NOT NULL AND confirmed_at IS NOT NULL)",
            name="visit_human_validation",
        ),
    )


class Task(Base):
    __tablename__ = "tasks"
    id = Column(String, primary_key=True, default=uid)
    patient_id = Column(ForeignKey("patients.id"), nullable=False)
    encounter_id = Column(ForeignKey("encounters.id"), nullable=False)
    visit_id = Column(ForeignKey("visits.id"))
    description = Column(Text, nullable=False)
    status = Column(String, default="OPEN", nullable=False)
    due_at = Column(String)
    created_at = Column(String, default=now, nullable=False)
    completed_at = Column(String)
    __table_args__ = (
        ForeignKeyConstraint(
            ["encounter_id", "patient_id"],
            ["encounters.id", "encounters.patient_id"],
            name="task_encounter_patient",
        ),
    )


class Document(Base):
    __tablename__ = "documents"
    id = Column(String, primary_key=True, default=uid)
    # candidate_patient_id is context only, not the definitive association.
    candidate_patient_id = Column(ForeignKey("patients.id"), nullable=False)
    patient_id = Column(ForeignKey("patients.id"))
    encounter_id = Column(ForeignKey("encounters.id"), nullable=False)
    scan_id = Column(ForeignKey("scans.id"), nullable=False)
    imported_by = Column(ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    storage_key = Column(String, unique=True, nullable=False)
    sha256 = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    status = Column(String, default="REVIEW_REQUIRED", nullable=False)
    identity_status = Column(String, nullable=False)
    document_type = Column(String, default="EXTERNAL_DOCUMENT", nullable=False)
    created_at = Column(String, default=now, nullable=False)
    validated_at = Column(String)
    validated_by = Column(ForeignKey("users.id"))
    ehr_status = Column(String, default="NOT_SENT", nullable=False)
    ehr_payload = Column(JSON)
    __table_args__ = (
        UniqueConstraint("candidate_patient_id", "sha256", name="uq_document_patient_hash"),
        ForeignKeyConstraint(
            ["encounter_id", "candidate_patient_id"],
            ["encounters.id", "encounters.patient_id"],
            name="document_encounter_candidate",
        ),
        CheckConstraint(
            "patient_id IS NULL OR patient_id = candidate_patient_id", name="document_identity_association"
        ),
        CheckConstraint(
            "status != 'VALIDATED' OR (patient_id IS NOT NULL AND validated_by IS NOT NULL AND validated_at IS NOT NULL AND identity_status != 'MISMATCH')",
            name="document_human_validation",
        ),
    )


class Extraction(Base):
    __tablename__ = "document_extractions"
    id = Column(String, primary_key=True, default=uid)
    document_id = Column(ForeignKey("documents.id"), unique=True, nullable=False)
    text = Column(Text, nullable=False)
    identifiers = Column(JSON, nullable=False)
    summary = Column(Text, nullable=False)
    method = Column(String, default="pypdf-text-v1", nullable=False)
    requires_review = Column(Boolean, default=True, nullable=False)


class Audit(Base):
    __tablename__ = "audit_log"
    id = Column(String, primary_key=True, default=uid)
    user_id = Column(ForeignKey("users.id"))
    action = Column(String, nullable=False)
    entity_id = Column(String)
    created_at = Column(String, default=now, nullable=False)
    details = Column(JSON, default=dict, nullable=False)
