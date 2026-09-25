"""Local, conservative text and document providers."""

import io
import re
from typing import Protocol

from fastapi import HTTPException
from pypdf import PdfReader


class SpeechToTextProvider(Protocol):
    def transcribe(self, audio: bytes) -> str: ...


class ClinicalStructuringProvider(Protocol):
    def structure(self, transcript: str) -> dict: ...


class ExtractiveDemoStructurer:
    def structure(self, transcript: str) -> dict:
        # Never infer a clinical fact: every item is a verbatim source span.
        parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", transcript) if part.strip()]
        note = {
            key: []
            for key in (
                "evolution",
                "symptoms",
                "signs",
                "results",
                "medications",
                "plan",
                "tasks",
                "questions_next_round",
                "uncertainties",
            )
        }
        for part in parts:
            target = "tasks" if part.casefold().startswith("pendiente:") else "evolution"
            note[target].append({"text": part, "source_span": part, "requires_review": True})
            if re.search(r"\b(o|revisar|quizás|incierto)\b|\d", part, flags=re.I):
                note["uncertainties"].append({"text": part, "source_span": part, "requires_review": True})
        note["suggested_evolution"] = conservative_redaction([item["text"] for item in note["evolution"]])
        note["redaction_method"] = "local-conservative-v1"
        return note


def conservative_redaction(parts: list[str]) -> str:
    """Improve paragraph flow and typography without adding clinical assertions."""
    sentences = []
    for part in parts:
        text = re.sub(r"\s+", " ", part).strip()
        # Remove only isolated oral hesitation tokens at the start of a sentence.
        text = re.sub(r"^(?:eh|em|mmm)[,;]\s*", "", text, flags=re.I)
        if not text:
            continue
        text = text[0].upper() + text[1:]
        if text[-1] not in ".!?":
            text += "."
        sentences.append(text)
    return " ".join(sentences)


class DocumentExtractionProvider(Protocol):
    def extract(self, content: bytes) -> str: ...


class PdfTextExtractor:
    def extract(self, content: bytes) -> str:
        try:
            reader = PdfReader(io.BytesIO(content), strict=True)
            if reader.is_encrypted or len(reader.pages) > 100:
                raise ValueError("encrypted or too many pages")
            # Reject active actions and embedded files. This is not an antivirus.
            for obj in reader.trailer["/Root"].keys():
                if obj in {"/OpenAction", "/AA"}:
                    raise ValueError("active PDF")
            if any(key in content for key in (b"/JavaScript", b"/JS", b"/EmbeddedFile", b"/Launch")):
                raise ValueError("active PDF")
            result = "\n".join(page.extract_text() or "" for page in reader.pages)
            if len(result) > 500_000:
                raise ValueError("text limit")
            return result
        except Exception as exc:
            raise HTTPException(422, "PDF no válido, protegido, activo o de más de 100 páginas.") from exc


class DocumentSummaryProvider(Protocol):
    def summarize(self, text: str) -> str: ...


class ExtractiveDocumentSummary:
    def summarize(self, text: str) -> str:
        if not text.strip():
            return "Sin capa de texto. Revisa el PDF original; OCR no disponible."
        lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
        lines = [line for line in lines if line]
        keywords = re.compile(
            r"\b(hallazg|resultado|conclusi|impresi|evoluci|alerg|medicamento|dosis|pendiente|"
            r"hemoglobina|hematocrito|leucocito|plaqueta|creatinina|glucosa|sodio|potasio|tsh|hba1c)\w*\b",
            re.I,
        )
        ranked = [
            (index, line)
            for index, line in enumerate(lines)
            if keywords.search(line) or re.search(r"\b\d+(?:[.,]\d+)?\s*(?:mg|g|mmol|mEq|U|%)/?\w*", line, re.I)
        ]
        selected = sorted(ranked[:8], key=lambda item: item[0])
        summary = "\n".join(line for _, line in selected)
        # Extracted lines remain verbatim except whitespace normalization.
        return (summary or "\n".join(lines))[:1200]


def identity_match(text: str, identifier: str):
    if identifier.startswith("SIM-"):
        identifiers = sorted(set(re.findall(r"\bSIM-\d{4}\b", text.upper())))
    else:
        # Extract only explicitly labelled citizenship IDs, never arbitrary lab values.
        matches = re.findall(
            r"(?:C[ÉE]DULA(?:\s+DE\s+CIUDADAN[ÍI]A)?|C\.?C\.?|IDENTIFICACI[ÓO]N)\s*[:#-]?\s*([0-9][0-9. ]{1,20}[0-9])",
            text.upper(),
        )
        identifiers = sorted({re.sub(r"[. ]", "", value) for value in matches})
    if identifiers:
        return ("MATCH" if identifiers == [identifier] else "MISMATCH"), identifiers
    return "NO_IDENTIFIERS", []


class EhrAdapter(Protocol):
    def submit(self, document) -> dict: ...


class MockEhrAdapter:
    def submit(self, document) -> dict:
        return {
            "resourceType": "DocumentReference",
            "id": document.id,
            "status": "current",
            "subject": {"reference": f"Patient/{document.patient_id}"},
            "context": {"encounter": [{"reference": f"Encounter/{document.encounter_id}"}]},
            "content": [{"attachment": {"contentType": "application/pdf", "url": f"Binary/{document.id}"}}],
            "simulation": True,
        }
