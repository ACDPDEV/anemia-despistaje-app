// Pure anemia evaluator for children aged 6-59 months.
// Single-band teaching table (g/dL):
//   Normal >= 11.0 | Mild 10.0-10.9 | Moderate 7.0-9.9 | Severe < 7.0
// No I/O, no stored state: identical inputs always yield identical outputs.

export type Diagnosis = "Normal" | "Anemia Leve" | "Anemia Moderada" | "Anemia Severa";

export function evaluatePatient(nivelHemoglobina: number): Diagnosis {
  if (nivelHemoglobina >= 11.0) return "Normal";
  if (nivelHemoglobina >= 10.0) return "Anemia Leve";
  if (nivelHemoglobina >= 7.0) return "Anemia Moderada";
  return "Anemia Severa";
}

// Shared clinical cutoffs (g/dL) backing evaluatePatient above.
// UI hints must import HB_CUTOFF_LABEL instead of retyping numbers so the
// copy can never drift from the evaluator.
export const HB_CUTOFF_LABEL =
  "Normal ≥ 11 · Leve 10–10.9 · Moderada 7–9.9 · Severa < 7";
