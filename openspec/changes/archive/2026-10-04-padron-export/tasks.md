# Tasks: padron-export

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 200–300 (builder ~100 + tests ~120 + wiring/CSS ~60) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | CSV export + print over visible rows | Single PR | `pnpm test` | `pnpm dev` → filter padrón → Exportar CSV + print preview | Revert `PadronView.tsx` + `index.css`, delete `padronExport.*` |

## Phase 1: CSV Builder (TDD)

- [x] 1.1 RED: create `src/lib/padronExport.test.ts` — hostile quoting (`;` `"` `,` newline), BOM first char, stats==visible rows, `padron-YYYY-MM-DD` filename, empty set. Prove fail with `pnpm test`.
- [x] 1.2 GREEN: create `src/lib/padronExport.ts` — `escapeCsvField`, `buildPadronCsv` (BOM + 4 stats lines + header + rows), `padronFilename`. Prove pass with `pnpm test`.
- [x] 1.3 REFACTOR: tighten types/comments in `src/lib/padronExport.ts`; keep zero DOM imports. Prove pass with `pnpm test`.

## Phase 2: PadronView Wiring (TDD)

- [x] 2.1 RED: extend `src/components/PadronView.test.tsx` — both buttons always render, `disabled` on empty, export feeds builder text to Blob/URL seam, Imprimir calls `window.print`. Prove fail with `pnpm test`.
- [x] 2.2 GREEN: modify `src/components/PadronView.tsx` — Exportar CSV / Imprimir buttons with `disabled={visible.length===0}`, Blob + anchor download, `window.print()`. Prove pass with `pnpm test`.

## Phase 3: Print CSS + Verification

- [x] 3.1 Modify `src/index.css` — `@media print` block hiding filters/buttons/action column, showing table + stats header. Verify with `pnpm test` + print preview.
- [x] 3.2 Verify table-only print and visible-rows scope against print-report scenarios (filtered set prints exactly).

## Phase 4: Gate

- [x] 4.1 Run `pnpm test` and `pnpm build` (tsc) green; confirm dated filename, Excel accents intact, disabled-on-empty.
