export type NumericLabPoint = {
  date: string;
  value: number;
  analyte: string;
  unit: string;
};

export function describeLabSeries(points: NumericLabPoint[]) {
  if (!points.length) return null;
  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = ordered[0];
  const latest = ordered[ordered.length - 1];
  const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null;
  const values = ordered.map((point) => point.value);
  const delta = previous ? latest.value - previous.value : null;
  const tolerance = previous
    ? Math.max(Math.abs(previous.value) * 0.001, 1e-9)
    : 0;
  const direction =
    delta === null
      ? "sin comparación"
      : Math.abs(delta) <= tolerance
        ? "sin cambio"
        : delta > 0
          ? "aumentó"
          : "disminuyó";
  return {
    analyte: latest.analyte,
    unit: latest.unit,
    first,
    latest,
    previous,
    delta,
    direction,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    count: ordered.length,
  };
}
