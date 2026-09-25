import { describe, expect, it } from "vitest";
import {
  buildFastClinicalProposal,
  isGroundedRedaction,
  parseJsonObject,
} from "../src/features/visits/clinicalNote";

describe("fast clinical note preparation", () => {
  it("keeps literal evidence while separating tasks and uncertainty", () => {
    const transcript =
      "Paciente niega dolor torácico. Posible edema leve. Pendiente: revisar hemograma mañana.";
    const result = buildFastClinicalProposal(transcript);

    expect(result.evolution.map((item) => item.source_span)).toEqual([
      "Paciente niega dolor torácico.",
      "Posible edema leve.",
    ]);
    expect(result.tasks[0].source_span).toBe(
      "Pendiente: revisar hemograma mañana.",
    );
    expect(result.uncertainties[0].source_span).toBe("Posible edema leve.");
    expect(result.suggested_evolution).toContain("niega dolor torácico");
  });

  it("extracts JSON surrounded by thinking, fences or explanatory text", () => {
    expect(
      parseJsonObject(
        '<think>razonamiento</think>```json\n{"suggested_evolution":"Paciente estable."}\n```',
      ),
    ).toEqual({ suggested_evolution: "Paciente estable." });
    expect(
      parseJsonObject(
        'Resultado: {"suggested_evolution":"Paciente refiere {dolor}."} fin',
      ),
    ).toEqual({ suggested_evolution: "Paciente refiere {dolor}." });
  });

  it("rejects invented medical words or changed numbers", () => {
    const source = "Paciente niega dolor. Saturación 96 por ciento.";
    expect(
      isGroundedRedaction(
        "Paciente niega dolor y saturación 96 por ciento.",
        source,
      ),
    ).toBe(true);
    expect(isGroundedRedaction("Paciente presenta fiebre.", source)).toBe(
      false,
    );
    expect(
      isGroundedRedaction(
        "Paciente niega dolor. Saturación 90 por ciento.",
        source,
      ),
    ).toBe(false);
  });
});
