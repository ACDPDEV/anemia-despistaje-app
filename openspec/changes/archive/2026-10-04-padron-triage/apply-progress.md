# Apply Progress: padron-triage

Mode: Strict TDD (runner: `pnpm test` / `vitest run`). No prior progress existed; this artifact creates it.
Scope: single slice, all 9 tasks (Phase 1 → Phase 4). No commit (orchestrator owns commits).

## Completed Tasks

- [x] 1.1 RED: `src/lib/normalize.test.ts` ("José"→"jose", trim/collapse, empty)
- [x] 1.2 GREEN: `src/lib/normalize.ts` with `normalizeNombre`
- [x] 2.1 RED: extended `src/stores/padronStore.test.ts` (rank order, tiebreak, copy-not-mutate, duplicates exact/negative/accent)
- [x] 2.2 GREEN: `SEVERITY_RANK`, `bySeverity(list)`, `findPossibleDuplicates(nombre)` in `src/stores/padronStore.ts`; `add()` untouched
- [x] 3.1 RED: extended `src/components/PadronView.test.tsx` (default order, sort on/off, alert line, badges, accent filter)
- [x] 3.2 GREEN: `PadronView.tsx` (`gravesPrimero` default off, copy+sort `visible`, alert line, outline badge, `normalizeNombre` filter)
- [x] 3.3 RED: extended `src/components/RegisterForm.test.tsx` (hint shows, submit registers, dismiss clears)
- [x] 3.4 GREEN: `RegisterForm.tsx` (dismissible "Posible duplicado…" hint after validation, never blocks `add`)
- [x] 4.1 Gate: `pnpm test` + `tsc --noEmit`

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1–1.2 | `src/lib/normalize.test.ts` | Unit | N/A (new) | ✅ module-missing failure | ✅ 3/3 pass | ✅ 3 cases (accents, whitespace, blank) | ➖ None needed (~10-line pure fn) |
| 2.1–2.2 | `src/stores/padronStore.test.ts` | Unit | ✅ 6/6 pre-existing | ✅ 5 new fail | ✅ 11/11 pass | ✅ 5 cases (rank, sort+copy, tiebreak, accent dup, negative) | ➖ None needed |
| 3.1–3.2 | `src/components/PadronView.test.tsx` | Integration | ✅ 7/7 pre-existing | ✅ 5 new fail | ✅ 12/12 pass | ✅ 5 cases (off/on/restore, alert, badges, accent filter) | ➖ None needed |
| 3.3–3.4 | `src/components/RegisterForm.test.tsx` | Integration | ✅ 2/2 pre-existing | ✅ 2 new fail | ✅ 4/4 pass | ✅ 2 cases (warn+register, dismiss) | ➖ None needed |

### Test Summary

- **Total tests written**: 15 (3 + 5 + 5 + 2)
- **Total tests passing**: 58/58 clean (no `.env`); 57/58 with local `.env`
- **Layers used**: Unit (8), Integration (7), E2E (0)
- **Approval tests**: None — no refactoring tasks
- **Pure functions created**: 1 (`normalizeNombre`) + 2 pure selectors (`bySeverity`, `findPossibleDuplicates` reads store state)

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm vitest run src/lib/normalize.test.ts src/stores/padronStore.test.ts src/components/PadronView.test.tsx src/components/RegisterForm.test.tsx` → 30/30 pass |
| Full suite (`.env` present) | `pnpm test` → 57/58; sole failure pre-existing `src/lib/sync.test.ts` env-credential case (baseline 42/43 before this slice; unrelated, out of scope) |
| Full suite (clean, `.env` moved aside) | `pnpm test` → 58/58 pass |
| Type gate | `pnpm exec tsc --noEmit` → exit 0 |
| Runtime harness | `pnpm dev` manual path untested here (no browser in worker); integration tests cover toggle/sort/badge/hint behavior. Recommend verify covers: toggle "Ver graves primero", register "Jose" vs "José" |
| Rollback boundary | Revert `src/lib/normalize.ts`, `src/lib/normalize.test.ts` (new) + edits to `src/stores/padronStore.ts`, `src/components/PadronView.tsx`, `src/components/RegisterForm.tsx` and their tests only. Toggle defaults off; no schema/persist change |

## Deviations from Design

None — implementation matches design. One scope note: RegisterForm hint fires on submit-path only (after validation, around `add`); blur-trigger from the design open question was not implemented, keeping the slice to the tasks artifact. Dismiss button uses `type="button"` so it never resubmits the form.

## Issues Found

- Pre-existing `sync.test.ts` failure with local `.env` (42/43 at baseline, 57/58 after slice; 58/58 clean). Not this slice's scope.
- Slice total is ~265 added lines vs the ~100–170 forecast (tests carry the weight; production code ≈ 100 lines). Single-PR delivery still holds per the tasks artifact (Low budget risk, chained PRs not recommended).

## Status

9/9 tasks complete. Ready for verify.
