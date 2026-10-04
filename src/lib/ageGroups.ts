// Pure presentation helper for the dashboard age chart.
// Groups patients into screening bands 6-23 vs 24-59 months.
// Boundary rule: edadMeses < 24 → "6-23", otherwise "24-59".
// Kept outside domain/anemia.ts: no clinical threshold involved.

export type AgeBand = "6-23" | "24-59";

export function groupByAgeBand(
  pacientes: Pick<{ edadMeses: number }, "edadMeses">[],
): Record<AgeBand, number> {
  const counts: Record<AgeBand, number> = { "6-23": 0, "24-59": 0 };
  for (const p of pacientes) {
    if (p.edadMeses < 24) counts["6-23"] += 1;
    else counts["24-59"] += 1;
  }
  return counts;
}
