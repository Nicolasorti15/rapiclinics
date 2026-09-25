from app.providers import ExtractiveDocumentSummary, grounded_redaction


def test_document_summary_prioritizes_grounded_clinical_lines():
    text = """CLÍNICA EJEMPLO
Página 1 de 3
Resultado: hemoglobina 12.4 g/dL
Texto administrativo sin información clínica
Conclusión: control programado según orden registrada
"""
    summary = ExtractiveDocumentSummary().summarize(text)
    assert "Resultado: hemoglobina 12.4 g/dL" in summary
    assert "Conclusión: control programado según orden registrada" in summary
    assert "Página 1 de 3" not in summary


def test_document_summary_never_adds_text_not_in_source():
    text = "Paciente estable."
    assert ExtractiveDocumentSummary().summarize(text) == text


def test_grounded_redaction_rejects_new_terms_and_changed_numbers():
    source = "Paciente niega dolor. Saturación 96 por ciento."
    assert grounded_redaction("Paciente niega dolor y saturación 96 por ciento.", source)
    assert not grounded_redaction("Paciente presenta fiebre.", source)
    assert not grounded_redaction("Paciente niega dolor. Saturación 90 por ciento.", source)
