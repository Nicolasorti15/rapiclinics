import { beforeEach, expect, it, vi } from "vitest";
import { LocalClinicalAI } from "../src/features/visits/localClinicalAI.android";

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  completion: vi.fn(),
  init: vi.fn(),
  release: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("expo-constants", () => ({
  default: { executionEnvironment: "bare" },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///private/",
  getInfoAsync: mocks.info,
  downloadAsync: vi.fn(),
  moveAsync: vi.fn(),
  deleteAsync: vi.fn(),
}));
vi.mock("llama.rn", () => ({ initLlama: mocks.init }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.info.mockResolvedValue({ exists: true, size: 396705472 });
  mocks.init.mockResolvedValue({
    completion: mocks.completion,
    release: mocks.release,
    stopCompletion: mocks.stop,
  });
});

it("uses the immediate grounded proposal when the small model returns invalid JSON", async () => {
  mocks.completion.mockResolvedValue({ text: "respuesta incompleta" });
  const ai = new LocalClinicalAI();
  const result = await ai.structure(
    "Paciente niega dolor. Pendiente: revisar hemograma.",
  );

  expect(result.redaction_method).toBe("local-conservative-fast-v2");
  expect(result.evolution[0].source_span).toBe("Paciente niega dolor.");
  expect(result.tasks[0].source_span).toBe("Pendiente: revisar hemograma.");
  await ai.dispose();
  expect(mocks.release).toHaveBeenCalledOnce();
});

it("accepts fenced grounded JSON and requests only the compact suggestion", async () => {
  mocks.completion.mockResolvedValue({
    text: '```json\n{"suggested_evolution":"Paciente niega dolor."}\n```',
  });
  const ai = new LocalClinicalAI();
  const result = await ai.structure("Paciente niega dolor.");

  expect(result.redaction_method).toBe("qwen3-0.6b-q4_k_m-fast-local-v2");
  expect(mocks.completion.mock.calls[0][0]).toMatchObject({
    temperature: 0,
    n_predict: 280,
    response_format: {
      json_schema: {
        schema: {
          required: ["suggested_evolution"],
        },
      },
    },
  });
  await ai.dispose();
});

it("falls back when the model invents a clinical fact", async () => {
  mocks.completion.mockResolvedValue({
    text: '{"suggested_evolution":"Paciente presenta fiebre."}',
  });
  const ai = new LocalClinicalAI();
  const result = await ai.structure("Paciente niega dolor.");

  expect(result.redaction_method).toBe("local-conservative-fast-v2");
  expect(result.suggested_evolution).toBe("Paciente niega dolor.");
  await ai.dispose();
});
