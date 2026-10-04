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

// Spanish decimal entry parser for every Hb input (create + edit row).
// Nurses type "11,5" with a comma, but <input type="number"> sanitizes the
// comma to "" BEFORE React's onChange fires — verified by probe in this
// repo's jsdom (onChange never fires for "11,5"/"11," on type=number, the
// DOM value reads "", Number("") is 0, and submit then misdiagnoses a
// correct Spanish entry as "debe ser mayor que 0"). Chrome follows the
// same HTML value-sanitization rule, so neither live normalization nor
// blur/submit normalization on a number input can ever see the comma: the
// value is already gone. Hb inputs are therefore type="text" with
// inputMode="decimal", and every entry funnels through here: trim, comma
// becomes period, then Number. "11,5" → 11.5, "11.5" → 11.5, "" / "abc" →
// NaN (callers diagnose those in Spanish as a format problem, never "> 0").
export function parseHemoglobina(raw: string): number {
  const normalized = raw.trim().replace(/,/g, ".");
  if (normalized.length === 0) return NaN;
  return Number(normalized);
}
