from types import SimpleNamespace

import numpy as np
import pytest
from fastapi import HTTPException

from app import speech


def test_transcription_uses_medical_context(monkeypatch):
    calls = {}

    class FakeModel:
        def transcribe(self, audio, **options):
            calls["audio"] = audio
            calls["options"] = options
            return [SimpleNamespace(text=" Presión arterial estable. ")], None

    monkeypatch.setattr(speech, "decode", lambda content: np.array([0.1], dtype=np.float32))
    monkeypatch.setattr(speech, "model", lambda: FakeModel())

    assert speech.LocalSpeechToText().transcribe(b"audio") == "Presión arterial estable."
    assert calls["options"]["language"] == "es"
    assert calls["options"]["beam_size"] == 2
    assert calls["options"]["best_of"] == 2
    assert "leucocitos" in calls["options"]["initial_prompt"]
    assert "creatinina" in calls["options"]["hotwords"]


@pytest.mark.parametrize(
    "audio,message",
    [
        (np.zeros(16000, dtype=np.float32), "demasiado bajo"),
        (np.ones(16000, dtype=np.float32), "saturado"),
    ],
)
def test_audio_quality_rejects_unusable_recordings(audio, message):
    with pytest.raises(HTTPException, match=message):
        speech.validate_audio_quality(audio)


def test_audio_quality_accepts_clear_signal():
    speech.validate_audio_quality(np.tile(np.array([-0.12, 0.12], dtype=np.float32), 8000))


def test_server_never_falls_back_to_tiny_for_clinical_dictation(monkeypatch):
    monkeypatch.setenv("WHISPER_MODEL", "tiny")
    assert speech.configured_model() == "base"
    monkeypatch.setenv("WHISPER_MODEL", "small")
    assert speech.configured_model() == "small"
