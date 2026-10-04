// Single Hb number voice: the dashboard average, the print receipt, and
// the CSV stats all format through here so screen and paper can never
// disagree. One decimal (toFixed(1)): the print/CSV wording was judged the
// trustworthy voice, and 0.1 g/dL matches the hemoglobinometer's own
// resolution, so the dashboard now speaks paper's language, not the reverse.
export function formatHb(value: number): string {
  return value.toFixed(1);
}
