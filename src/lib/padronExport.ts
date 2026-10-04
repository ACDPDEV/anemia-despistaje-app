import type { Paciente } from "../stores/padronStore";
import { formatHb } from "./formatHb";

export const PADRON_CSV_HEADER =
  "nombre,edad_meses,hemoglobina,diagnostico";

const BOM = "\uFEFF";

// Quote the field when it carries a comma, semicolon, double quote,
// carriage return, or newline. Inner quotes are doubled (RFC 4180).
export function escapeCsvField(value: string | number): string {
  const text = String(value);
  if (!/[,;"\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}

function localDateStamp(date: Date): string {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

// Dated download name from the local date: padron-YYYY-MM-DD.csv
export function padronFilename(date: Date): string {
  return `padron-${localDateStamp(date)}.csv`;
}

// Pure CSV builder over the visible rows (WYSIWYG scope): BOM + 4 stats
// lines + column header + one quoted row per patient. Stats derive from
// the same row set. Zero DOM imports — the component owns Blob/download.
export function buildPadronCsv(rows: Paciente[], date: Date): string {
  const moderateSevere = rows.filter(
    (p) => p.diagnostico === "Anemia Moderada" || p.diagnostico === "Anemia Severa",
  ).length;
  const average =
    rows.length === 0
      ? 0
      : rows.reduce((sum, p) => sum + p.nivelHemoglobina, 0) / rows.length;
  const lines = [
    `# padron ${localDateStamp(date)}`,
    `# total: ${rows.length}`,
    `# moderada+severa: ${moderateSevere}`,
    `# promedio Hb: ${formatHb(average)} g/dL`,
    PADRON_CSV_HEADER,
    ...rows.map((p) =>
      [
        escapeCsvField(p.nombre),
        escapeCsvField(p.edadMeses),
        escapeCsvField(p.nivelHemoglobina),
        escapeCsvField(p.diagnostico),
      ].join(","),
    ),
  ];
  return `${BOM}${lines.join("\n")}\n`;
}
