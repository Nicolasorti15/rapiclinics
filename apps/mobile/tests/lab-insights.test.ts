import { describe, expect, it } from "vitest";
import { describeLabSeries } from "../src/features/labs/labInsights";

describe("descriptive lab insights", () => {
  it("summarizes direction and range without interpreting clinical meaning", () => {
    const result = describeLabSeries([
      { date: "2026-09-01", value: 8.2, analyte: "Leucocitos", unit: "10^9/L" },
      { date: "2026-09-05", value: 7.1, analyte: "Leucocitos", unit: "10^9/L" },
    ]);
    expect(result).toMatchObject({
      direction: "disminuyó",
      minimum: 7.1,
      maximum: 8.2,
      count: 2,
    });
    expect(result?.delta).toBeCloseTo(-1.1);
  });

  it("does not claim a trend from one observation", () => {
    const result = describeLabSeries([
      { date: "2026-09-01", value: 13, analyte: "Hemoglobina", unit: "g/dL" },
    ]);
    expect(result?.direction).toBe("sin comparación");
    expect(result?.delta).toBeNull();
  });
});
