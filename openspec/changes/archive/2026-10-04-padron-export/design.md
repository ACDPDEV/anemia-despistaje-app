# Design: padron-export

## Technical Approach

Pure builder `src/lib/padronExport.ts` owns all logic (stats, quoting, filename); `PadronView` passes its existing `visible` array (filter + `bySeverity` sort) into it — WYSIWYG scope, no new derivation. Thin DOM seam (`Blob` → `URL.createObjectURL` → temp `<a>` click → `revokeObjectURL`; `window.print()`) stays in the component and is mocked in jsdom. Print isolation via one `@media print` block in `src/index.css`. Covers `csv-export` (new), `print-report` (new), `padron-table` delta (actions).

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Delimiter: comma `,` (RFC 4180) vs semicolon `;` (es-Excel default) | `;` avoids es-Excel config but collides with data; `,` is spec-canonical, parseable everywhere | **Lock comma `,`.** `;` treated as hostile data, never as separator. Quoting triggers on `,;"\r\n`. |
| Export scope: visible rows vs full store | Full store simpler but violates WYSIWYG spec | **Visible rows (`visible` array) for CSV body, stats, and print.** Stats derive from same array. |
| BOM: prepend `U+FEFF` vs plain UTF-8 | 3 extra bytes; plain breaks accents in Excel | **Prepend BOM.** Tests assert `text[0] === "\uFEFF"`. |
| Download seam: component Blob/anchor vs lib side-effect | Lib side-effect untestable in jsdom | **Pure lib returns string; component owns Blob/anchor/print.** Lib has zero DOM imports. |
| Print: `@media print` CSS vs separate route | Route heavier, duplicates table | **CSS block hiding chrome** (`form`, filters, action column, buttons) + print-only stats header. |

## Data Flow

```
store.pacientes ──→ filter(normalizeNombre) ──→ bySeverity? ──→ visible[]
  visible[] ──→ buildPadronCsv() ──→ string ──→ Blob ──→ anchor.click → .csv
  visible[] ──→ <Table> + print-header ──→ window.print() ──→ @media print CSS
```

CSV layout (locked): `# padron YYYY-MM-DD` / `# total: N` / `# moderada+severa: M` / `# promedio Hb: X.X g/dL` / `nombre,edad_meses,hemoglobina,diagnostico` / quoted rows. Print header shows the same four fields: title+date, `Total: N`, `Moderada + Severa: M`, `Promedio Hb: X.X g/dL`. Avg over same visible set, 1 decimal.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/lib/padronExport.ts` | Create | `buildPadronCsv`, `padronFilename`, `escapeCsvField` (~100 lines, pure) |
| `src/lib/padronExport.test.ts` | Create | Hostile-input, BOM, stats, filename tests |
| `src/components/PadronView.tsx` | Modify | Exportar CSV / Imprimir buttons in header, `disabled={visible.length===0}`, download + print handlers |
| `src/components/PadronView.test.tsx` | Modify | Seam tests: Blob/URL/print mocks, disabled-on-empty |
| `src/index.css` | Modify | `@media print` block: hide chrome, show table + header |

## Interfaces / Contracts

```ts
import type { Paciente } from "../stores/padronStore";
export function buildPadronCsv(rows: Paciente[], date: Date): string; // BOM + 4 stats lines + header + rows
export function padronFilename(date: Date): string; // `padron-YYYY-MM-DD.csv` (local date)
function escapeCsvField(v: string | number): string; // quote if /[",;\r\n]/
```

`downloadCsv(csv: string, filename: string): void` lives inline in `PadronView` (Blob + anchor). Disabled rule: both buttons always render with `disabled={visible.length===0}` — never hidden or removed, per csv-export + print-report specs.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Hostile quoting (`;` `"` `,` newline), BOM, stats==rows incl. avg Hb, filename date | Vitest on pure builder; round-trip parse-back assertion |
| Component | Export triggers Blob download with builder text; print calls `window.print`; both disabled on empty | jsdom: mock `URL.createObjectURL/revokeObjectURL`, `HTMLAnchorElement.click`, `window.print` |
| E2E | — | None (out of scope) |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Zero deps, no store change. Rollback: revert `PadronView` wiring + `index.css` block; delete `padronExport.ts` + test.
