import Constants, { ExecutionEnvironment } from "expo-constants";
import type { LlamaContext } from "llama.rn";
import {
  buildFastClinicalProposal,
  isGroundedRedaction,
  parseJsonObject,
  type FastClinicalProposal,
} from "./clinicalNote";

export const localClinicalAIAvailable =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

const MODEL_URL =
  "https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/50968a4468ef4233ed78cd7c3de230dd1d61a56b/Qwen3-0.6B-Q4_K_M.gguf?download=true";

const MODEL_FILENAME = "qwen3-0.6b-q4_k_m.gguf";
const MODEL_SIZE = 396705472;

type RawProposal = {
  suggested_evolution: string;
};

export type LocalClinicalProposal = FastClinicalProposal;

const proposalSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggested_evolution"],
  properties: {
    suggested_evolution: {
      type: "string",
    },
  },
};

export class LocalClinicalAI {
  private closed = false;
  private context?: LlamaContext;
  private contextPromise?: Promise<LlamaContext>;
  private modelPromise?: Promise<string>;
  private completing = false;

  private async installModel(onStatus: (text: string) => void) {
    const fs = await import("expo-file-system/legacy");

    if (!fs.documentDirectory)
      throw new Error("No hay almacenamiento disponible para el modelo.");

    const path = fs.documentDirectory + MODEL_FILENAME;
    const info = await fs.getInfoAsync(path);

    if (!info.exists || info.size !== MODEL_SIZE) {
      onStatus("Descargando IA clínica rápida (~397 MB)…");

      const partial = path + ".partial";

      try {
        await fs.deleteAsync(partial, { idempotent: true });

        const response = await fs.downloadAsync(MODEL_URL, partial);
        const downloaded = await fs.getInfoAsync(partial);

        if (
          response.status !== 200 ||
          !downloaded.exists ||
          downloaded.size !== MODEL_SIZE
        )
          throw new Error(
            "La descarga del modelo quedó incompleta. Reintenta con una conexión estable.",
          );

        await fs.deleteAsync(path, { idempotent: true });
        await fs.moveAsync({ from: partial, to: path });
        await fs.deleteAsync(fs.documentDirectory + "qwen3-1.7b-q4_k_m.gguf", {
          idempotent: true,
        });
      } catch (error) {
        await fs.deleteAsync(partial, { idempotent: true });
        throw error;
      }
    }

    return path;
  }

  private ensureModel(onStatus: (text: string) => void) {
    this.modelPromise ??= this.installModel(onStatus).catch((error) => {
      this.modelPromise = undefined;
      throw error;
    });
    return this.modelPromise;
  }

  private prepareContext(onStatus: (text: string) => void) {
    if (this.context) return Promise.resolve(this.context);
    if (this.contextPromise) return this.contextPromise;

    this.contextPromise = this.ensureModel(onStatus)
      .then(async (modelPath) => {
        if (this.closed) throw new Error("Procesamiento cancelado.");
        const { initLlama } = await import("llama.rn");
        const context = await initLlama({
          model: modelPath,
          n_ctx: 1536,
          n_batch: 256,
          n_threads: 4,
          n_gpu_layers: 0,
          use_mlock: false,
        });
        if (this.closed) {
          await context.release();
          throw new Error("Procesamiento cancelado.");
        }
        this.context = context;
        return context;
      })
      .finally(() => {
        this.contextPromise = undefined;
      });

    return this.contextPromise;
  }

  async warmUp(onStatus: (text: string) => void = () => {}) {
    if (!localClinicalAIAvailable || this.closed) return;
    try {
      await this.prepareContext(onStatus);
    } finally {
      onStatus("");
    }
  }

  private async readyContext() {
    const preparing = this.prepareContext(() => {}).catch(() => null);
    return Promise.race([
      preparing,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
  }

  async structure(
    transcript: string,
    onStatus: (text: string) => void = () => {},
  ): Promise<LocalClinicalProposal> {
    const cleanTranscript = transcript.trim();

    if (!cleanTranscript)
      throw new Error("No hay transcripción para estructurar.");

    if (!localClinicalAIAvailable)
      throw new Error(
        "La IA local requiere la app Android compilada; no funciona en Expo Go.",
      );

    if (this.closed) throw new Error("Procesamiento cancelado.");
    const fallback = buildFastClinicalProposal(cleanTranscript);
    onStatus("Preparando nota clínica…");
    const context = await this.readyContext();
    if (!context) {
      onStatus("");
      return fallback;
    }

    try {
      if (this.closed) throw new Error("Procesamiento cancelado.");
      this.completing = true;
      const result = await context.completion({
        messages: [
          {
            role: "system",
            content: `Mejora únicamente la puntuación, el orden y la cohesión de la transcripción clínica. Conserva todas las negaciones, medicamentos, dosis, vías, unidades, cifras, fechas y hechos. No agregues diagnósticos, tratamientos ni información. Devuelve solo el JSON solicitado.`,
          },
          {
            role: "user",
            content: `TRANSCRIPCIÓN:\n${cleanTranscript}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            strict: true,
            schema: proposalSchema,
          },
        },
        enable_thinking: false,
        temperature: 0,
        n_predict: 280,
      });

      if (this.closed) throw new Error("Procesamiento cancelado.");

      try {
        const parsed = parseJsonObject(result.text) as RawProposal;
        const suggestion =
          typeof parsed?.suggested_evolution === "string"
            ? parsed.suggested_evolution.trim()
            : "";
        if (!isGroundedRedaction(suggestion, cleanTranscript)) return fallback;
        return {
          ...fallback,
          suggested_evolution: suggestion,
          redaction_method: "qwen3-0.6b-q4_k_m-fast-local-v2",
        };
      } catch {
        return fallback;
      }
    } catch {
      if (this.closed) throw new Error("Procesamiento cancelado.");
      return fallback;
    } finally {
      this.completing = false;
      onStatus("");
    }
  }

  async dispose() {
    this.closed = true;

    if (this.completing) await this.context?.stopCompletion();
    await this.contextPromise?.catch(() => {});
    await this.context?.release();
    this.context = undefined;
  }
}
