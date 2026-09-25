from types import SimpleNamespace

import numpy as np

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
    assert calls["options"]["beam_size"] == 5
    assert "leucocitos" in calls["options"]["initial_prompt"]
    assert "creatinina" in calls["options"]["hotwords"]
