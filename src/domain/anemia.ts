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
