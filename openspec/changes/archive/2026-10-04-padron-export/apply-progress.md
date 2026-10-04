# Apply Progress: padron-export

**Change**: padron-export · **Branch**: slice-3-sync · **Mode**: Strict TDD
**Work unit**: CSV export + print over visible rows (single PR, stacked-to-main)
**Date**: 2026-10-04 · **Token**: sha256:92b9d5f12264309c416315e9908ff84bf10fc3477da2f0fe79ede6b02642a441

All 8 tasks complete (Phases 1–4). No prior apply-progress existed; this file creates it.

## Safety Net Baseline (before any edit)

`pnpm test` on clean tree: **57 passed / 1 failed (58)**. The single failure is
pre-existing and environmental: `src/lib/sync.test.ts > is a no-op without
credentials` expects `isSupabaseConfigured() === false`, but the local `.env`
provides credentials so it returns `true`. Untouched by this slice.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 Builder tests | `src/lib/padronExport.test.ts` | Unit | N/A (new file) | ✅ Fail: unresolvable `./padronExport` import, 0 collected | — | — | — |
| 1.2 Builder impl | `src/lib/padronExport.test.ts` | Unit | N/A (new file) | ✅ (from 1.1) | ✅ 7/7 `pnpm vitest run src/lib/padronExport.test.ts` | ✅ 7 cases: plain + hostile quoting, BOM/accents, stats==visible, round-trip parse-back, empty set, 2 filename dates | — |
| 1.3 Tighten types | `src/lib/padronExport.test.ts` | Unit | ✅ 7/7 | ✅ (carried) | ✅ 7/7 after refactor | ➖ Single behavior, cases already cover | ✅ BOM literal → explicit `\uFEFF` escape; zero DOM imports verified by grep |
| 2.1 Wiring tests | `src/components/PadronView.test.tsx` | Component (jsdom) | ✅ 12/12 existing pass | ✅ 6 new fail (`Unable to find … /exportar csv/i`), 12 existing pass | — | — | — |
| 2.2 Wiring impl | `src/components/PadronView.test.tsx` | Component (jsdom) | ✅ 12/12 | ✅ (from 2.1) | ✅ 18/18 | ✅ 6 cases: render, disabled-on-filter-empty, disabled-on-store-empty, full Blob seam, filtered-only scope, `window.print` | ✅ Scoped pre-existing alert-count query to `role="status"` (print header legitimately repeats stats) |
| 3.1 Print CSS | `src/index.css` | Manual inspection + suite | ✅ suite green | ➖ CSS has no RED layer; rule verified by component tests + inspection | ✅ `@media print` hides `.padron-filters/.padron-actions/.padron-action-col`, shows `.padron-print-header` | ➖ Structural, single output | ➖ None needed |
| 3.2 Print scope verify | component tests | Component | ✅ | — | ✅ filtered-export test proves visible-rows scope (`# total: 1`, Luis excluded) | ✅ | — |
| 4.1 Gate | full suite + build | — | — | — | ✅ see Work Unit Evidence | — | — |

### Test Summary

- **Total tests written**: 13 (7 builder + 6 component)
- **Total tests passing**: 71/71 (`.env` removed) — see environment note
- **Layers used**: Unit (7), Component/jsdom (6), E2E (0 — out of scope per design)
- **Approval tests**: None — no refactoring of existing behavior (one query scoping, intent preserved)
- **Pure functions created**: 3 (`escapeCsvField`, `buildPadronCsv`, `padronFilename`)

### TDD Fixes During GREEN (real behavior, not trivial)

1. Test arithmetic: header split length 8 → 9 (trailing newline element). Test bug, fixed in test.
2. jsdom `Blob.text()` missing → FileReader-based `readBlobText` helper in test.
3. FileReader strips BOM on decode → assert body equality on BOM-stripped text
   PLUS `blob.size === new Blob([expected]).size` (proves BOM bytes present).
4. Print header duplicated "Moderada + Severa" text broke pre-existing
   `getByText` uniqueness → scoped old assertion to `getByRole("status")`.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run src/components/PadronView.test.tsx src/lib/padronExport.test.ts` → **2 files, 25/25 passed** |
| Full suite with `.env` (as found) | **70 passed / 1 failed (71)** — only failure is the pre-existing `sync.test.ts` credentials case (identical to baseline before this slice) |
| Full suite without `.env` | **10 files, 71/71 passed** (`.env` restored afterward) |
| Runtime harness | `pnpm build` (tsc --noEmit + vite) → ✅ built in ~11s. `pnpm dev` + manual print preview not run headless; print isolation verified by CSS inspection + component scope tests |
| Rollback boundary | Revert `src/components/PadronView.tsx` + `src/index.css`; delete `src/lib/padronExport.ts` + `src/lib/padronExport.test.ts`; restore old alert-count query in `PadronView.test.tsx`. No store/schema/deps changes |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/lib/padronExport.ts` | Created | Pure builder: `escapeCsvField` (quotes on `,;"\r\n`), `buildPadronCsv` (BOM + 4 stats lines + header + rows), `padronFilename` (`padron-YYYY-MM-DD.csv`) |
| `src/lib/padronExport.test.ts` | Created | 7 unit tests: quoting, BOM/accents, stats==visible, round-trip parser, empty set, filename |
| `src/components/PadronView.tsx` | Modified | Exportar CSV / Imprimir buttons (`disabled={visible.length===0}`, always rendered incl. empty state), Blob+anchor download, `window.print()`, print-only stats header, `padron-*` print classes |
| `src/components/PadronView.test.tsx` | Modified | 6 seam tests: render, disabled states, Blob/URL/filename seam, filtered scope, print call |
| `src/index.css` | Modified | `@media print` block: hide filters/actions/action-column, show print header |
| `openspec/changes/padron-export/tasks.md` | Modified | All 8 tasks checked `[x]` |

## Deviations from Design

None — implementation matches design. One intent-preserving test adjustment:
pre-existing alert-count query scoped to `role="status"` because the new
print-only header legitimately repeats the same stats text (required by design).

## Issues Found

- Known environment quirk confirmed both runs: local `.env` breaks 1 sync test
  (`isSupabaseConfigured()` true). Pre-existing, unrelated, recorded with/without runs.
- jsdom gaps handled via seam mocks: no `Blob.text()`, no layout/print —
  covered with FileReader helper and `URL`/`window.print` mocks per design.

## Status

8/8 tasks complete. Ready for verify.
