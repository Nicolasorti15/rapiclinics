"""Local speech recognition. Audio never leaves the API host."""

import io
import os
import threading
from functools import lru_cache

from fastapi import HTTPException

_inference = threading.Lock()


@lru_cache(maxsize=1)
def model():
    from faster_whisper import WhisperModel

    return WhisperModel(
        os.getenv("WHISPER_MODEL", "small"),
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


class LocalSpeechToText:
    def transcribe(self, content: bytes) -> str:
        audio = decode(content)
        if not _inference.acquire(blocking=False):
            raise HTTPException(503, "Hay otra transcripción en curso. Inténtalo en unos momentos.")
        try:
            segments, _ = model().transcribe(
                audio, language="es", beam_size=5, vad_filter=True, condition_on_previous_text=False
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
