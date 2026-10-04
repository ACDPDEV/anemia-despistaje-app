# Tasks: Padron Triage (severity queue + duplicate warning)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~100–170 |
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
| 1 | Severity queue + duplicate warning, single slice | PR 1 | `pnpm test` | `pnpm dev` → toggle "Ver graves primero", register "Jose" vs "José" | Revert PR 1; toggle defaults off, no schema touched |

## Phase 1: Foundation — normalize helper (TDD)

- [x] 1.1 RED: create `src/lib/normalize.test.ts` ("José"→"jose", trim/collapse, empty)
- [x] 1.2 GREEN: create `src/lib/normalize.ts` with `normalizeNombre`

## Phase 2: Core — store selectors (TDD)

- [x] 2.1 RED: extend `src/stores/padronStore.test.ts` (`SEVERITY_RANK` order, stable tiebreak, copy-not-mutate, `findPossibleDuplicates` exact/negative/accent)
- [x] 2.2 GREEN: add `SEVERITY_RANK`, `bySeverity(list)`, `findPossibleDuplicates(nombre)` to `src/stores/padronStore.ts` via `normalizeNombre`; `add()` untouched

## Phase 3: Integration — views + filter wiring

- [x] 3.1 RED: extend `src/components/PadronView.test.tsx` (toggle off default order, on sorts Severa→Normal, alert line "Moderada + Severa: N", badge on dup rows, "Jose" finds "José")
- [x] 3.2 GREEN: modify `src/components/PadronView.tsx` (`gravesPrimero` useState default off, copy+sort `visible`, alert line, `PadronRow` outline badge, filter via `normalizeNombre`)
- [x] 3.3 RED: extend `src/components/RegisterForm.test.tsx` (hint shows, submit still registers, dismiss clears)
- [x] 3.4 GREEN: modify `src/components/RegisterForm.tsx` (dismissible "Posible duplicado…" hint after validation, never blocks `add`)

## Phase 4: Verification — gate

- [x] 4.1 Run `pnpm test` (full suite green) and `pnpm build` (`tsc --noEmit` gate)
