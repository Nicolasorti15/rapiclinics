"""Local speech recognition. Audio never leaves the API host."""

import io
import os
import threading
from functools import lru_cache

from fastapi import HTTPException

_inference = threading.Lock()

MEDICAL_PROMPT = (
    "Dictado de evolución médica en español colombiano. Conserva negaciones, cifras, dosis y unidades. "
    "Paciente niega, no presenta, sin evidencia de, antecedentes, alergias, examen físico, consciente, "
    "alerta, orientado, Glasgow, hemodinámicamente estable, afebril, dolor, cefalea, disnea, edema, "
    "diuresis, balance hídrico, presión arterial, TA, frecuencia cardíaca, FC, frecuencia respiratoria, "
    "FR, saturación, SatO2, FiO2, murmullo vesicular, ruidos cardíacos, abdomen blando depresible, "
    "hemoglobina, hematocrito, leucocitos, neutrófilos, linfocitos, plaquetas, creatinina, BUN, urea, "
    "glucosa, sodio, potasio, proteína C reactiva, PCR, procalcitonina, INR, lactato, gases arteriales, "
    "oxígeno por cánula nasal, acetaminofén, dipirona, ceftriaxona, piperacilina tazobactam, "
    "vancomicina, enoxaparina, heparina, insulina, diagnóstico, tratamiento, pendiente, control, "
    "intravenoso, intramuscular, subcutáneo y vía oral."
)
MEDICAL_HOTWORDS = (
    "presión arterial TA frecuencia cardíaca FC frecuencia respiratoria FR saturación SatO2 FiO2 "
    "Glasgow hemodinámicamente afebril murmullo vesicular ruidos cardíacos abdomen blando depresible "
    "hemoglobina hematocrito leucocitos neutrófilos linfocitos plaquetas creatinina BUN urea sodio "
    "potasio proteína C reactiva PCR procalcitonina INR lactato gases arteriales intravenoso "
    "intramuscular subcutáneo oxígeno cánula nasal acetaminofén dipirona ceftriaxona piperacilina "
    "tazobactam vancomicina enoxaparina heparina insulina alergias paciente niega no presenta sin evidencia"
)


def configured_model():
    configured = os.getenv("WHISPER_MODEL", "base").strip()
    # Tiny produced unacceptable medication, number and negation errors in clinical dictation.
    return "base" if configured in {"tiny", "tiny.en"} else configured


@lru_cache(maxsize=1)
def model():
    from faster_whisper import WhisperModel

    return WhisperModel(
        configured_model(),
        device="cpu",
        compute_type="int8",
        cpu_threads=max(1, int(os.getenv("WHISPER_CPU_THREADS", "4"))),
    )


def decode(content: bytes):
    import av
    import numpy as np

    frames = []
    samples = 0
    try:
        with av.open(io.BytesIO(content)) as container:
            resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)
            for frame in container.decode(audio=0):
                for converted in resampler.resample(frame):
                    chunk = converted.to_ndarray().flatten()
                    samples += len(chunk)
                    if samples > 16000 * 180:
                        raise HTTPException(413, "El audio supera los 3 minutos. Graba una visita más breve.")
                    frames.append(chunk)
            for converted in resampler.resample(None):
                chunk = converted.to_ndarray().flatten()
                samples += len(chunk)
                frames.append(chunk)
        if not frames or samples > 16000 * 180:
            raise HTTPException(422, "Audio vacío o demasiado largo.")
        return np.concatenate(frames).astype(np.float32) / 32768.0
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, "No se pudo leer el audio. Vuelve a grabarlo.") from exc


def validate_audio_quality(audio):
    import numpy as np

    rms = float(np.sqrt(np.mean(np.square(audio, dtype=np.float64))))
    clipped_ratio = float(np.mean(np.abs(audio) >= 0.99))
    if rms < 0.003:
        raise HTTPException(422, "El audio se escucha demasiado bajo. Acerca el teléfono y vuelve a grabar.")
    if clipped_ratio > 0.15:
        raise HTTPException(422, "El audio está saturado. Aleja un poco el teléfono y vuelve a grabar.")


class LocalSpeechToText:
    def transcribe(self, content: bytes) -> str:
        audio = decode(content)
        validate_audio_quality(audio)
        if not _inference.acquire(blocking=False):
            raise HTTPException(503, "Hay otra transcripción en curso. Inténtalo en unos momentos.")
        try:
            segments, _ = model().transcribe(
                audio,
                language="es",
                beam_size=2,
                best_of=2,
                temperature=0,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 350, "speech_pad_ms": 250},
                condition_on_previous_text=False,
                without_timestamps=True,
                initial_prompt=MEDICAL_PROMPT,
                hotwords=MEDICAL_HOTWORDS,
            )
            text = " ".join(segment.text.strip() for segment in segments).strip()
            if not text:
                raise HTTPException(422, "No se detectó voz clara. Acerca el micrófono y vuelve a grabar.")
            if len(text) > 20000:
                raise HTTPException(422, "La transcripción es demasiado larga.")
            return text
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                503,
                "La transcripción local no está disponible. Revisa la instalación del modelo en el servidor.",
            ) from exc
        finally:
            _inference.release()
