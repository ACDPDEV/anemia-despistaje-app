## Exploration: padron-export

### Current State
The padron lives in a persisted Zustand store (`src/stores/padronStore.ts`): `pacientes` array plus `add/update/remove` and read selectors `countByDiagnosis()` and `averageHb()`. Pure helpers `bySeverity()` (stable severity sort) and `findPossibleDuplicates()` are exported from the store module. `PadronView.tsx` renders the register: empty state when `pacientes.length === 0`, otherwise a name filter (`normalizeNombre`, substring match) plus a "Ver graves primero" checkbox (`bySeverity(filtered)`), displayed in a shadcn Table. `DashboardView.tsx` derives all KPIs from the same selectors plus pure mappers (`toHbBandData`, `groupByAgeBand`). There is NO export/download/print code anywhere (grep for Blob/print/CSV/download: zero hits in app code). Styling is Tailwind CSS v4 CSS-first (`src/index.css`, no print rules today). Tests are Vitest + Testing Library (9 test files); `PadronView.test.tsx` seeds via `usePadronStore.getState().add()` after `localStorage.clear()` + `reset()` — the established TDD seeding pattern to reuse.

### Affected Areas
- `src/lib/padronExport.ts` (new) — pure CSV builder + stats-header helper + filename helper.
- `src/components/PadronView.tsx` — add "Exportar CSV" and "Imprimir" buttons wired to the visible rows; disabled on empty padron.
- `src/index.css` — small `@media print` block (or Tailwind `print:` variants) hiding tabs/filter/actions, showing only the table.
- `src/lib/padronExport.test.ts` (new) — strict-TDD unit tests: RFC 4180 quoting, stats header, filename, empty behavior.
- `src/components/PadronView.test.tsx` — extend with export-button behavior tests (mock Blob/URL per jsdom limits).

### Approaches
1. **Blob-download CSV + print CSS (recommended)** — pure function builds CSV text (stats header lines + `nombre,edad_meses,hemoglobina,diagnostico` rows with RFC 4180 quoting, `\uFEFF` BOM for Excel accents); component creates `Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })`, `URL.createObjectURL`, temporary `<a download="padron-YYYY-MM-DD.csv">` click, `revokeObjectURL`. Print via `window.print()` plus a minimal `@media print` stylesheet.
   - Pros: zero new deps (constraint satisfied); fully testable pure builder (~80-120 lines total); works offline in Tauri/WebView; print CSS is 10-20 lines; matches existing `lib/` pure-helper pattern (`normalize.ts`, `ageGroups.ts`).
   - Cons: no styled PDF output (plain table print only); jsdom cannot fully exercise Blob download (needs light mocking).
   - Effort: Low

2. **PDF library (jspdf + autotable) or print-only without CSV** — add `jspdf` dependency and generate a formatted PDF, or rely solely on `window.print()` with no file artifact.
   - Pros: prettier printable report (PDF option); print-only is even fewer lines.
   - Cons: violates the no-new-deps constraint; adds ~300KB+ bundle for a <=100-row report; PDF layout code is harder to unit-test under strict TDD; print-only alone fails the "exportable" requirement (no portable file for health-post reporting).
   - Effort: Medium

### Recommendation
Go with Approach 1. Place the CSV builder in `src/lib/padronExport.ts` (not in the store): the store holds state + minimal selectors, while `lib/` is the established home for pure, independently tested transformers — same shape as `groupByAgeBand()` consumed by `DashboardView`. Export **what the user sees** (filtered + severity-sorted visible rows) and derive the stats header from that same exported set (pure count/average over the rows), so header numbers always match the file body; record this WYSIWYG decision in the proposal. Filename `padron-YYYY-MM-DD.csv` from local date. Print strategy: minimal `@media print` in `src/index.css` (hide tabs, filter, checkboxes, action column; expand table to full width) using Tailwind `print:hidden` utilities where possible. Empty padron: both buttons disabled (or hidden) with the existing "No hay pacientes registrados." message retained; exporting empty is a no-op — no empty file download, no alert.

### Risks
- CSV field quoting edge cases (names with `;`, quotes, newlines) — mitigated by RFC 4180 quoting tests with hostile inputs.
- jsdom lacks real download/print — Blob + `URL.createObjectURL` + `window.print` need mocks; keep DOM side-effect code to a 10-line untestable seam, all logic in the pure builder.
- Filter-vs-full export mismatch confusion — resolved by the WYSIWYG rule above; must be stated explicitly in proposal/spec so reviewers do not re-litigate.
- Excel accent rendering (Spanish names/diagnoses) — include UTF-8 BOM; verify by reading the Blob text in tests.

### Ready for Proposal
Yes — proceed to sdd-propose for `padron-export`. Tell the user: CSV-via-Blob + print-CSS confirmed, builder goes in `src/lib/`, export covers visible (filtered/sorted) rows with matching stats header, `padron-YYYY-MM-DD.csv` naming, disabled buttons on empty padron, zero new dependencies.
