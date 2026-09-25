import Constants, { ExecutionEnvironment } from "expo-constants";
import { PcmCapture } from "./pcm";
import type { WhisperContext } from "whisper.rn/index";
import { MEDICAL_TRANSCRIPTION_PROMPT } from "./medicalVocabulary";

export const localWhisperAvailable =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small-q5_1.bin";
const MODEL_SIZE = 190085487;
type Stream = {
  init(options: {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    audioSource: number;
    bufferSize: number;
  }): Promise<void>;
  start(): void;
  stop(): Promise<void>;
  on(event: "data", callback: (data: string) => void): { remove(): void };
};

export class LocalWhisper {
  private capture = new PcmCapture();
  private stream?: Stream;
  private listener?: { remove(): void };
  private job?: ReturnType<WhisperContext["transcribeData"]>;
  private closed = false;
  private recording = false;
  private modelPath?: string;
  private stopping?: Promise<void>;

  async start(
    onDuration: (ms: number) => void,
    onLimit: () => void,
    onStatus: (text: string) => void,
  ) {
    if (!localWhisperAvailable)
      throw new Error(
        "Whisper requiere la app Android compilada; no funciona en Expo Go.",
      );
    await this.stopping;
    const fs = await import("expo-file-system/legacy");
    if (!fs.documentDirectory)
      throw new Error("No hay almacenamiento disponible para el modelo.");
    const path = fs.documentDirectory + "whisper-small-q5-clinical.bin";
    const info = await fs.getInfoAsync(path);
    if (!info.exists || info.size !== MODEL_SIZE) {
      onStatus("Descargando modelo clínico de alta precisión (190 MB)…");
      const partial = path + ".partial";
      try {
        const response = await fs.downloadAsync(MODEL_URL, partial);
        const downloaded = await fs.getInfoAsync(partial);
        if (
          response.status !== 200 ||
          !downloaded.exists ||
          downloaded.size !== MODEL_SIZE
        )
          throw new Error(
            "La descarga del modelo quedó incompleta. Reintenta con conexión.",
          );
        await fs.deleteAsync(path, { idempotent: true });
        await fs.moveAsync({ from: partial, to: path });
        await fs.deleteAsync(
          fs.documentDirectory + "whisper-tiny-multilingual.bin",
          { idempotent: true },
        );
        await fs.deleteAsync(
          fs.documentDirectory + "whisper-base-multilingual.bin",
          { idempotent: true },
        );
      } finally {
        await fs.deleteAsync(partial, { idempotent: true });
      }
    }
    if (this.closed) throw new Error("Grabación cancelada.");
    this.modelPath = path;
    // Import only on Android outside Expo Go; the published PCM typings name a different package.
    const pcmModule =
      // @ts-expect-error The installed 1.1.4 declaration is not a module.
      await import("@fugood/react-native-audio-pcm-stream");
    const { base64ToUint8Array } = await import("whisper.rn/utils/common");
    if (this.closed) throw new Error("Grabación cancelada.");
    this.stream = pcmModule.default as Stream;
    await this.stream.init({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6,
      bufferSize: 4096,
    });
    this.capture.clear();
    this.recording = true;
    this.listener = this.stream.on("data", (base64) => {
      if (!this.recording) return;
      const full = this.capture.append(base64ToUint8Array(base64));
      onDuration(this.capture.count / 16);
      if (full) {
        void this.stop();
        onLimit();
      }
    });
    this.stream.start();
    if (this.closed) await this.stop();
    onStatus("");
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    if (!this.recording) return Promise.resolve();
    this.recording = false;
    this.listener?.remove();
    this.listener = undefined;
    // Expo plugin adds the missing native completion barrier to 1.1.4.
    this.stopping = Promise.resolve(this.stream?.stop()).finally(() => {
      this.stopping = undefined;
    });
    return this.stopping;
  }

  async transcribe(): Promise<string> {
    await this.stop();
    const data = this.capture.data();
    this.capture.assertUsable();
    if (!this.modelPath || this.closed)
      throw new Error("Graba un audio primero.");
    const { initWhisper } = await import("whisper.rn/index");
    const context = await initWhisper({
      filePath: this.modelPath,
      useGpu: false,
    });
    try {
      if (this.closed) throw new Error("Transcripción cancelada.");
      this.job = context.transcribeData(data, {
        language: "es",
        translate: false,
        prompt: MEDICAL_TRANSCRIPTION_PROMPT,
        beamSize: 8,
        bestOf: 8,
        temperature: 0,
      });
      const result = await this.job.promise;
      if (result.isAborted || this.closed)
        throw new Error("Transcripción cancelada.");
      if (!result.result.trim())
        throw new Error(
          "No se reconoció voz. Vuelve a grabar o escribe la nota.",
        );
      return result.result.trim();
    } finally {
      this.job = undefined;
      await context.release();
    }
  }

  async dispose() {
    this.closed = true;
    await this.stop();
    await this.job?.stop();
    this.capture.clear();
  }
}
