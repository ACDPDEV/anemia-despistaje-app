import { describe, expect, it } from "vitest";
import {
  buildPadronCsv,
  escapeCsvField,
  padronFilename,
} from "./padronExport";
import type { Paciente } from "../stores/padronStore";

function makePaciente(
  overrides: Partial<Paciente> = {},
  index = 0,
): Paciente {
  return {
    id: `p-${index}`,
    nombre: "Ana Torres",
    edadMeses: 24,
    nivelHemoglobina: 12.0,
    diagnostico: "Normal",
    updatedAt: "2026-10-04T00:00:00.000Z",
    dirty: false,
    ...overrides,
  };
}

// Minimal RFC 4180 parser used only to prove hostile fields round-trip.
function parseCsvRows(text: string): string[][] {
  const body = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  // Skip the 4 stats comment lines + column header line (5 lines).
  const lines = body.split("\n");
  const rest = lines.slice(5).join("\n");
  while (i < rest.length) {
    const ch = rest[i];
    if (quoted) {
      if (ch === '"') {
        if (rest[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          quoted = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
    } else if (ch === '"') {
      quoted = true;
      i += 1;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i += 1;
    } else if (ch === "\r") {
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

const EXPORT_DATE = new Date(2026, 9, 4); // 2026-10-04 local

describe("escapeCsvField", () => {
  it("leaves plain fields untouched", () => {
    expect(escapeCsvField("Ana Torres")).toBe("Ana Torres");
    expect(escapeCsvField(24)).toBe("24");
  });

  it("quotes fields containing semicolon, comma, quote, or newline", () => {
    expect(escapeCsvField("a;b")).toBe('"a;b"');
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('dice "hola"')).toBe('"dice ""hola"""');
    expect(escapeCsvField("línea uno\nlínea dos")).toBe(
      '"línea uno\nlínea dos"',
    );
  });
});

describe("buildPadronCsv", () => {
  it("starts with a UTF-8 BOM so Excel keeps accents intact", () => {
    const csv = buildPadronCsv(
      [makePaciente({ nombre: "José" })],
      EXPORT_DATE,
    );
    expect(csv[0]).toBe("\uFEFF");
    expect(csv).toContain("José");
  });

  it("exports visible rows with stats derived from that same set", () => {
    const rows = [
      makePaciente({ nombre: "Nora Normal", nivelHemoglobina: 12.0 }, 0),
      makePaciente({
        nombre: "Severo Soto",
        nivelHemoglobina: 6.5,
        diagnostico: "Anemia Severa",
      }, 1),
      makePaciente({
        nombre: "Leve Lara",
        nivelHemoglobina: 10.5,
        diagnostico: "Anemia Leve",
      }, 2),
    ];
    const csv = buildPadronCsv(rows, EXPORT_DATE);
    const text = csv.replace(/^\uFEFF/, "");
    const lines = text.split("\n");
    expect(lines[0]).toBe("# padron 2026-10-04");
    expect(lines[1]).toBe("# total: 3");
    expect(lines[2]).toBe("# moderada+severa: 1");
    expect(lines[3]).toBe("# promedio Hb: 9.7 g/dL");
    expect(lines[4]).toBe("nombre,edad_meses,hemoglobina,diagnostico");
    expect(lines).toHaveLength(9); // 5 header + 3 rows + trailing split
    expect(lines[5]).toContain("Nora Normal");
    expect(lines[6]).toContain("Severo Soto");
    expect(lines[7]).toContain("Leve Lara");
  });

  it("round-trips hostile fields back to their original values", () => {
    const hostile = 'Rosa; "La, Brava"\nPérez';
    const csv = buildPadronCsv(
      [makePaciente({ nombre: hostile })],
      EXPORT_DATE,
    );
    const parsed = parseCsvRows(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0][0]).toBe(hostile);
    expect(parsed[0]).toHaveLength(4);
  });

  it("handles an empty row set with zeroed stats and no body rows", () => {
    const csv = buildPadronCsv([], EXPORT_DATE);
    expect(csv[0]).toBe("\uFEFF");
    const text = csv.replace(/^\uFEFF/, "");
    const lines = text.split("\n");
    expect(lines[0]).toBe("# padron 2026-10-04");
    expect(lines[1]).toBe("# total: 0");
    expect(lines[2]).toBe("# moderada+severa: 0");
    expect(lines[3]).toBe("# promedio Hb: 0.0 g/dL");
    expect(lines[4]).toBe("nombre,edad_meses,hemoglobina,diagnostico");
    expect(lines.filter((l) => !l.startsWith("#") && l.length > 0)).toHaveLength(1);
  });
});

describe("padronFilename", () => {
  it("names the download padron-YYYY-MM-DD.csv from the local date", () => {
    expect(padronFilename(new Date(2026, 9, 4))).toBe(
      "padron-2026-10-04.csv",
    );
    expect(padronFilename(new Date(2026, 0, 5))).toBe(
      "padron-2026-01-05.csv",
    );
  });
});
