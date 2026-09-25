import Constants, { ExecutionEnvironment } from "expo-constants";
import { PcmCapture } from "./pcm";
import type { WhisperContext } from "whisper.rn/index";
import { MEDICAL_TRANSCRIPTION_PROMPT } from "./medicalVocabulary";

export const localWhisperAvailable =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const FAST_MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base-q5_1.bin";
const FAST_MODEL_SIZE = 59707625;
const PRECISE_MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small-q5_1.bin";
const PRECISE_MODEL_SIZE = 190085487;
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
  private context?: WhisperContext;
  private contextPromise?: Promise<WhisperContext>;
  private contextModelPath?: string;
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
    const path = await this.ensureModel("fast", onStatus);
    if (this.closed) throw new Error("Grabación cancelada.");
    this.modelPath = path;
    void this.prepareContext().catch(() => {});
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

  private async ensureModel(
    quality: "fast" | "precise",
    onStatus: (text: string) => void,
  ) {
    const fs = await import("expo-file-system/legacy");
    if (!fs.documentDirectory)
      throw new Error("No hay almacenamiento disponible para el modelo.");
    const precise = quality === "precise";
    const path =
      fs.documentDirectory +
      (precise ? "whisper-small-q5-clinical.bin" : "whisper-base-q5-fast.bin");
    const size = precise ? PRECISE_MODEL_SIZE : FAST_MODEL_SIZE;
    const url = precise ? PRECISE_MODEL_URL : FAST_MODEL_URL;
    const info = await fs.getInfoAsync(path);
    if (info.exists && info.size === size) return path;

    onStatus(
      precise
        ? "Descargando modelo de mayor precisión (190 MB), solo esta vez…"
        : "Descargando modelo clínico rápido (60 MB)…",
    );
    const partial = path + ".partial";
    try {
      const response = await fs.downloadAsync(url, partial);
      const downloaded = await fs.getInfoAsync(partial);
      if (response.status !== 200 || !downloaded.exists || downloaded.size !== size)
        throw new Error(
          "La descarga del modelo quedó incompleta. Reintenta con conexión.",
        );
      await fs.deleteAsync(path, { idempotent: true });
      await fs.moveAsync({ from: partial, to: path });
      if (!precise) {
        await fs.deleteAsync(
          fs.documentDirectory + "whisper-tiny-multilingual.bin",
          { idempotent: true },
        );
        await fs.deleteAsync(
          fs.documentDirectory + "whisper-base-multilingual.bin",
          { idempotent: true },
        );
      }
    } finally {
      await fs.deleteAsync(partial, { idempotent: true });
    }
    return path;
  }

  private prepareContext(): Promise<WhisperContext> {
    if (this.context && this.contextModelPath === this.modelPath)
      return Promise.resolve(this.context);
    if (this.contextPromise)
      return this.contextPromise.then(() => this.prepareContext());
    if (!this.modelPath)
      return Promise.reject(new Error("Modelo no disponible."));

    const requestedPath = this.modelPath;
    this.contextPromise = Promise.resolve()
      .then(async () => {
        if (this.context) await this.context.release();
        this.context = undefined;
        this.contextModelPath = undefined;
        return import("whisper.rn/index");
      })
      .then(({ initWhisper }) =>
        initWhisper({
          filePath: requestedPath,
          useGpu: false,
        }),
      )
      .then(async (context) => {
        if (this.closed) {
          await context.release();
          throw new Error("Transcripción cancelada.");
        }
        this.context = context;
        this.contextModelPath = requestedPath;
        return context;
      })
      .finally(() => {
        this.contextPromise = undefined;
      });

    return this.contextPromise;
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

  async transcribe(
    quality: "fast" | "precise" = "fast",
    onStatus: (text: string) => void = () => {},
  ): Promise<string> {
    await this.stop();
    this.capture.assertUsable();
    const data = this.capture.transcriptionData();
    if (this.closed) throw new Error("Transcripción cancelada.");
    if (!this.modelPath) throw new Error("Graba un audio primero.");
    if (quality === "precise") {
      this.modelPath = await this.ensureModel("precise", onStatus);
      onStatus("Analizando nuevamente con mayor precisión…");
    }
    const context = await this.prepareContext();
    if (this.closed) throw new Error("Transcripción cancelada.");
    this.job = context.transcribeData(data, {
      language: "es",
      translate: false,
      prompt: MEDICAL_TRANSCRIPTION_PROMPT,
      beamSize: quality === "precise" ? 4 : 2,
      bestOf: quality === "precise" ? 4 : 2,
      temperature: 0,
    });
    try {
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
    }
  }

  async dispose() {
    this.closed = true;
    await this.stop();
    await this.job?.stop();
    await this.contextPromise?.catch(() => {});
    await this.context?.release();
    this.context = undefined;
    this.contextModelPath = undefined;
    this.capture.clear();
  }
}
