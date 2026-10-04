// Pure name normalizer shared by padron filter and duplicate detection.
// Trim → lowercase → NFD diacritic strip → collapse whitespace.
// "  María  López " → "maria lopez"; "José" → "jose".
export function normalizeNombre(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
