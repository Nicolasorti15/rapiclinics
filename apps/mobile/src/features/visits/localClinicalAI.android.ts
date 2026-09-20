import Constants, { ExecutionEnvironment } from "expo-constants";
import type { NoteItem } from "../../types";

export const localClinicalAIAvailable =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

const MODEL_URL =
  "https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/f74f4773ef976969660897cd81122d9c1bb8ad7c/Qwen3-1.7B-Q4_K_M.gguf?download=true";

const MODEL_FILENAME = "qwen3-1.7b-q4_k_m.gguf";
const MODEL_MIN_BYTES = 1_000_000_000;
const MODEL_MAX_BYTES = 1_300_000_000;

type RawItem = {
  text: string;
  source_span: string;
};

type RawProposal = {
  evolution: RawItem[];
  tasks: RawItem[];
  uncertainties: RawItem[];
  suggested_evolution: string;
};

export type LocalClinicalProposal = {
  evolution: NoteItem[];
  tasks: NoteItem[];
  uncertainties: NoteItem[];
  suggested_evolution: string;
  redaction_method: string;
};

const itemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "source_span"],
  properties: {
    text: { type: "string" },
    source_span: { type: "string" },
  },
};

const proposalSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "evolution",
    "tasks",
    "uncertainties",
    "suggested_evolution",
  ],
  properties: {
    evolution: {
      type: "array",
      items: itemSchema,
    },
    tasks: {
      type: "array",
      items: itemSchema,
    },
    uncertainties: {
      type: "array",
      items: itemSchema,
    },
    suggested_evolution: {
      type: "string",
    },
  },
};

function validateItem(item: RawItem, transcript: string): NoteItem {
  const text = item?.text?.trim();
  const sourceSpan = item?.source_span?.trim();

  if (!text || !sourceSpan)
    throw new Error("La IA local produjo un elemento incompleto.");

  if (!transcript.includes(sourceSpan))
    throw new Error(
      "La IA local produjo una referencia que no existe en la transcripción.",
    );

  return {
    text,
    source_span: sourceSpan,
    requires_review: true,
  };
}

function validateProposal(
  value: RawProposal,
  transcript: string,
): LocalClinicalProposal {
  if (
    !value ||
    !Array.isArray(value.evolution) ||
    !Array.isArray(value.tasks) ||
    !Array.isArray(value.uncertainties) ||
    typeof value.suggested_evolution !== "string"
  )
    throw new Error("La IA local devolvió una estructura no válida.");

  return {
    evolution: value.evolution.map((item) =>
      validateItem(item, transcript),
    ),
    tasks: value.tasks.map((item) =>
      validateItem(item, transcript),
    ),
    uncertainties: value.uncertainties.map((item) =>
      validateItem(item, transcript),
    ),
    suggested_evolution:
      value.suggested_evolution.trim() || transcript.trim(),
    redaction_method: "qwen3-1.7b-q4_k_m-local-v1",
  };
}

export class LocalClinicalAI {
  private closed = false;
  private activeContext?: {
    stopCompletion(): Promise<void>;
    release(): Promise<void>;
  };

  private async ensureModel(onStatus: (text: string) => void) {
    const fs = await import("expo-file-system/legacy");

    if (!fs.documentDirectory)
      throw new Error("No hay almacenamiento disponible para el modelo.");

    const path = fs.documentDirectory + MODEL_FILENAME;
    const info = await fs.getInfoAsync(path);

    if (
      !info.exists ||
      typeof info.size !== "number" ||
      info.size < MODEL_MIN_BYTES ||
      info.size > MODEL_MAX_BYTES
    ) {
      onStatus("Descargando IA clínica local (~1,1 GB)…");

      const partial = path + ".partial";

      try {
        await fs.deleteAsync(partial, { idempotent: true });

        const response = await fs.downloadAsync(MODEL_URL, partial);
        const downloaded = await fs.getInfoAsync(partial);

        if (
          response.status !== 200 ||
          !downloaded.exists ||
          typeof downloaded.size !== "number" ||
          downloaded.size < MODEL_MIN_BYTES ||
          downloaded.size > MODEL_MAX_BYTES
        )
          throw new Error(
            "La descarga del modelo quedó incompleta. Reintenta con una conexión estable.",
          );

        await fs.deleteAsync(path, { idempotent: true });
        await fs.moveAsync({ from: partial, to: path });
      } catch (error) {
        await fs.deleteAsync(partial, { idempotent: true });
        throw error;
      }
    }

    return path;
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

    if (this.closed)
      throw new Error("Procesamiento cancelado.");

    const modelPath = await this.ensureModel(onStatus);

    if (this.closed)
      throw new Error("Procesamiento cancelado.");

    onStatus("Cargando IA clínica en el teléfono…");

    const { initLlama } = await import("llama.rn");

    const context = await initLlama({
      model: modelPath,
      n_ctx: 3072,
      n_batch: 128,
      n_gpu_layers: 0,
      use_mlock: false,
    });

    this.activeContext = context;

    try {
      if (this.closed)
        throw new Error("Procesamiento cancelado.");

      onStatus("Preparando propuesta clínica local…");

      const result = await context.completion({
        messages: [
          {
            role: "system",
            content: `Eres el módulo local de asistencia para documentación clínica de RAPICLINICS.

Tu única fuente de información es la TRANSCRIPCIÓN proporcionada por el profesional de salud.

OBJETIVO:
Organizar y mejorar la redacción de información explícitamente presente en la transcripción para facilitar su revisión humana.

REGLAS OBLIGATORIAS:
- No inventes información.
- No completes información ausente.
- No hagas diagnósticos nuevos.
- No sugieras tratamientos, medicamentos, dosis, estudios ni conductas no mencionadas.
- No conviertas sospechas, posibilidades o preguntas en hechos confirmados.
- Conserva exactamente el sentido de todas las negaciones.
- Conserva medicamentos, dosis, unidades, vías, frecuencias, números, fechas, duraciones, resultados, lateralidad, antecedentes y alergias.
- Nunca cambies un número, medicamento, dosis, unidad o fecha por otro.
- Si un dato es ambiguo, contradictorio o incompleto, colócalo en uncertainties en lugar de resolverlo.
- No infieras información usando conocimiento médico general.
- No resuelvas referencias ambiguas si la transcripción no permite hacerlo con seguridad.

SOURCE_SPAN:
- Cada elemento debe incluir source_span.
- source_span debe ser una copia literal y exacta de un fragmento existente en la transcripción.
- No corrijas, resumas ni parafrasees source_span.

EVOLUTION:
- Incluye únicamente hechos clínicos explícitos relevantes.

TASKS:
- Incluye únicamente pendientes o acciones mencionados explícitamente.
- No generes pendientes nuevos.

UNCERTAINTIES:
- Incluye datos ambiguos, contradictorios, incompletos o que requieran confirmación.
- Ante la duda, usa uncertainties en lugar de asumir.

SUGGESTED_EVOLUTION:
Puedes mejorar puntuación, eliminar muletillas, reorganizar frases y mejorar claridad.
No puedes añadir hechos, diagnósticos, conclusiones, recomendaciones ni información ausente.

Toda salida es únicamente un borrador pendiente de revisión por el profesional.`,
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
        temperature: 0.1,
        n_predict: 800,
      });

      if (this.closed)
        throw new Error("Procesamiento cancelado.");

      let parsed: RawProposal;

      try {
        parsed = JSON.parse(result.text) as RawProposal;
      } catch {
        throw new Error("La IA local no produjo JSON válido.");
      }

      return validateProposal(parsed, cleanTranscript);
    } finally {
      try {
        await context.release();
      } finally {
        if (this.activeContext === context)
          this.activeContext = undefined;
        onStatus("");
      }
    }
  }

  async dispose() {
    this.closed = true;

    const context = this.activeContext;
    if (!context) return;

    await context.stopCompletion();
  }
}