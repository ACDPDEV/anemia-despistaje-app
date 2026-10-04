# Proposal: padron-export

## Intent

Health-post staff cannot take the padrón out of the app: no file export, no printable report. Add CSV download plus print view over visible rows so filtered results can be shared and filed.

## Scope

### In Scope
- CSV download of visible (filtered + severity-sorted) rows with stats header, dated filename, disabled on empty.
- Print stylesheet: table-only print view via `window.print()`.
- Unit + component tests for builder and button behavior.

### Out of Scope
- PDF generation (jspdf), styled reports, email/share integrations.
- Schema or store-shape changes; server-side export or pagination.

## Capabilities

### New Capabilities
- `csv-export`: build and download RFC 4180 CSV (BOM, stats header, dated filename) from visible rows.
- `print-report`: print-only table view hiding filters/actions via print CSS.

### Modified Capabilities
- `padron-table`: add Exportar CSV / Imprimir actions; disabled-on-empty rule; WYSIWYG visible-rows scope.

## Approach

Pure builder `src/lib/padronExport.ts` (CSV text, stats header, filename); `PadronView` creates Blob + object URL + temp anchor click, `revokeObjectURL` after; `window.print()` for print. Minimal `@media print` in `src/index.css` (Tailwind `print:` where possible). Strict TDD on builder; thin DOM seam mocked in jsdom.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/padronExport.ts` | New | Pure CSV/stats/filename builder (~80-120 lines) |
| `src/components/PadronView.tsx` | Modified | Export + print buttons, visible-rows wiring |
| `src/index.css` | Modified | `@media print` block hiding chrome |
| `src/lib/padronExport.test.ts` | New | Quoting, header, filename, empty tests |
| `src/components/PadronView.test.tsx` | Modified | Button behavior with Blob/URL mocks |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| CSV quoting breaks on `;`, quotes, newlines | Med | RFC 4180 quoting + hostile-input tests |
| jsdom lacks Blob download / print | High | 10-line DOM seam; logic stays in pure builder; mock URL/print |
| Excel mangles accents | Low | UTF-8 BOM; assert Blob text in tests |

## Rollback Plan

Revert `PadronView` button wiring and `index.css` print block; delete `padronExport.ts` + test. No data migration; store untouched, so rollback is a clean file revert.

## Dependencies

- None. Zero new deps; no schema change.

## Success Criteria

- [ ] CSV downloads `padron-YYYY-MM-DD.csv`, opens in Excel with intact accents.
- [ ] Exported rows and header stats match visible table rows.
- [ ] Buttons disabled on empty padrón; no empty-file download.
- [ ] `pnpm test` and `pnpm build` (tsc) green.
