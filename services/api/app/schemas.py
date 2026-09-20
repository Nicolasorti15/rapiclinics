from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Login(StrictModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=256)


class Refresh(StrictModel):
    refresh_token: str = Field(max_length=256)


class Resolve(StrictModel):
    token: str = Field(min_length=8, max_length=256)


class ConfirmPatient(StrictModel):
    confirmed_patient_id: str


class CreateVisit(StrictModel):
    scan_id: str


class Draft(StrictModel):
    transcript: str = Field(min_length=1, max_length=20000)
    evolution: str | None = Field(default=None, max_length=20000)
    tasks: list[str] = Field(default_factory=list, max_length=30)


class LocalNoteItem(StrictModel):
    text: str = Field(min_length=1, max_length=2000)
    source_span: str = Field(min_length=1, max_length=2000)


class LocalClinicalProposal(StrictModel):
    evolution: list[LocalNoteItem] = Field(default_factory=list, max_length=100)
    tasks: list[LocalNoteItem] = Field(default_factory=list, max_length=30)
    uncertainties: list[LocalNoteItem] = Field(default_factory=list, max_length=50)
    suggested_evolution: str = Field(min_length=1, max_length=20000)
    redaction_method: str = Field(min_length=1, max_length=100)


class NoteReview(StrictModel):
    reviewed: Literal[True]
    evolution: str = Field(min_length=1, max_length=20000)
    tasks: list[str] = Field(default_factory=list, max_length=30)


class TaskUpdate(StrictModel):
    status: Literal["OPEN", "DONE", "CANCELLED"]


class DocumentValidation(StrictModel):
    scan_id: str
    confirmed_patient_id: str
    reviewed: Literal[True]
    identity_manually_checked: bool = False


class EhrSubmission(StrictModel):
    confirmed: Literal[True]
