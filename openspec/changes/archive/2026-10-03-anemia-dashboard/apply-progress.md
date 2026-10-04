# Apply Progress: anemia-dashboard — Unit 1 (Foundation) + Unit 2 (Helper + Dashboard) + Unit 3 (Table + Tabs + Gate)

- Change: `anemia-dashboard`
- Work units: Unit 1 — shadcn foundation (PR1 slice, auto-chain stacked-to-main) ✅ · Unit 2 — ageGroups + DashboardView (PR2 slice, auto-chain stacked-to-main) ✅ · Unit 3 — PadronView table + App Tabs + gate (PR3 slice, auto-chain stacked-to-main) ✅
- Branch: `slice-3-sync` (Unit 3 builds on the same uncommitted tree)
- Native attempt token: `sha256:ad835f01b52d15f9abbde339936892a88c3b56d1ffa6770fc04261d317bd596b` (state: proceed)
- Mode: Strict TDD (active). No fallback taken.
- Scope guard: STOP after Unit 3 (gate included). No sync/lib ageGroups/DashboardView logic touched.

- Change: `anemia-dashboard`
- Work units: Unit 1 — shadcn foundation (PR1 slice, auto-chain stacked-to-main) ✅ · Unit 2 — ageGroups + DashboardView (PR2 slice, auto-chain stacked-to-main) ✅
- Branch: `slice-3-sync` (Unit 1 verified at tip `0 0` vs origin; Unit 2 builds on the same uncommitted tree)
- Native attempt token: `sha256:6ad0e5ce16f481a54e86c9f2a0be06d6743ba87976d79608d93562c7dc687c5f` (state: proceed)
- Mode: Strict TDD (active). No fallback taken.
- Scope guard: STOP after Unit 2. No `PadronView`/`App` Tabs work (Unit 3 untouched). No Supabase live reads. UI Spanish, code/comments English.

- Change: `anemia-dashboard`
- Work unit: Unit 1 — shadcn foundation (PR1 slice, auto-chain stacked-to-main)
- Branch: `slice-3-sync` (verified at tip: `git rev-list --left-right --count origin/slice-3-sync...slice-3-sync` = `0 0`; `main` and other slices untouched)
- Native attempt token: `sha256:92e0475446fd17d0b6a04b52d73055aa26db09b71812a073757949db2a7d881d` (state: proceed)
- Mode: Strict TDD (active). Foundation has no RED/GREEN of its own; the gate (prior 32 green + tsc clean) is the evidence. No fallback taken.
- Scope guard: STOP after Unit 1. No `DashboardView`/table work (Units 2-3 untouched). No Spanish UI changes. No view/domain edits.

## Completed Tasks (Phase 1)

- [x] 1.1 Rebase onto `slice-3-sync` tip; confirm `pnpm test` 32 green baseline
- [x] 1.2 Run shadcn init (Tailwind v4): `components.json`, `src/lib/utils.ts` (`cn()`), `src/components/ui/*` (button, card, table, input, badge, tabs, chart)
- [x] 1.3 Rewrite `src/index.css` tokens; `@/*` alias in `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`; deps in `package.json`
- [x] 1.4 Gate: `pnpm tsc --noEmit && pnpm test` green

## How It Was Built

1. Baseline first: branch already at `origin/slice-3-sync` tip; tracked tree clean (only pre-existing untracked dirs `.agents/`, `.atl/`, `.claude/`, `agent/`, `openspec/`, `skills-lock.json`).
2. `pnpm dlx shadcn@latest init` is interactive without flags, so it was driven non-interactively with CLI defaults: `--template vite -b base --preset nova` (Base UI base, Nova preset, lucide icons — answers the design open questions with defaults).
3. The CLI refuses to init without a valid `@/*` alias, so the alias wiring (task 1.3) was applied BEFORE init completed: `baseUrl` + `paths` in `tsconfig.json`, `resolve.alias` in `vite.config.ts` and `vitest.config.ts`, plus `@types/node` (dev) so the `node:path` config imports type-check.
4. Init output: `components.json` (style `base-nova`, aliases `@/*`), `src/lib/utils.ts` (`cn()`), `src/components/ui/button.tsx`, `src/index.css` semantic-token rewrite (Tailwind v4 `@theme inline`, `:root`/`.dark` vars, `@layer base`).
5. Added the remaining six components: `pnpm dlx shadcn@latest add -y card table input badge tabs chart` (chart pulled in `recharts 3.8.0`).

## TDD Cycle Evidence (Strict TDD hard gate)

| Task | RED (test written first) | GREEN (implementation passes) | REFACTOR |
|------|--------------------------|-------------------------------|----------|
| 1.1 Baseline | N/A — no production behavior added or changed | `pnpm test` → 32/32 green on clean env (see env note); `pnpm tsc --noEmit` exit 0 | N/A — no code written |
| 1.2 shadcn init | N/A — generated foundation, no behavior under test | Gate below covers it: no new failures vs baseline | N/A — generated output kept as-is |
| 1.3 Alias + tokens + deps | N/A — config-only change | `pnpm tsc --noEmit` exit 0; `pnpm dev` boot → HTTP 200 | N/A |
| 1.4 Gate | N/A — the gate IS the evidence per assignment | `pnpm tsc --noEmit` exit 0; `pnpm test` 32/32 green on clean env; 31/32 with local `.env` (identical single pre-existing failure, no regression) | N/A |

## Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command and exact result | `pnpm tsc --noEmit` → exit 0 (clean, `ui/*` included). `pnpm test` → 32 passed / 32 files green (7 files) on clean env; 31 passed + 1 pre-existing env-sensitive failure with local `.env` present (see Issues). |
| Runtime harness command/scenario and exact result | `pnpm dev` boot on fixed port 1420 → `curl http://127.0.0.1:1420/` returned HTTP 200. No UI scenario beyond boot (no views changed in Unit 1). |
| Rollback boundary | Tracked edits: `src/index.css`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `package.json`, `pnpm-lock.yaml`. New files: `components.json`, `src/lib/utils.ts`, `src/components/ui/*` (7 files). Rollback: `git checkout -- src/index.css tsconfig.json vite.config.ts vitest.config.ts package.json pnpm-lock.yaml`; delete `components.json`, `src/lib/utils.ts`, `src/components/ui/`; `pnpm remove` the added deps. No other code depends on the new files yet. |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `components.json` | Created (generated) | shadcn config: `base-nova`, lucide, `@/*` aliases |
| `src/lib/utils.ts` | Created (generated) | `cn()` re-export from `cn` package |
| `src/components/ui/button.tsx` | Created (generated) | Init output |
| `src/components/ui/{card,table,input,badge,tabs,chart}.tsx` | Created (generated) | Component add output |
| `src/index.css` | Modified (generated rewrite) | Tailwind v4 semantic tokens (`@theme inline`, `:root`/`.dark`, base layer) |
| `tsconfig.json` | Modified | `baseUrl` + `@/*` paths |
| `vite.config.ts` | Modified | `resolve.alias @ → ./src` |
| `vitest.config.ts` | Modified | `resolve.alias @ → ./src` |
| `package.json` / `pnpm-lock.yaml` | Modified | Init/add deps + `@types/node` (dev) |
| `openspec/changes/anemia-dashboard/tasks.md` | Modified | Phase 1 tasks 1.1–1.4 checked |
| `openspec/changes/anemia-dashboard/apply-progress.md` | Created | This file |

Actual dependency set installed by the CLI (Base UI base, Nova preset): `@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`, `recharts 3.8.0`, `tw-animate-css`, `@fontsource-variable/geist`, `shadcn` (CLI), plus dev `@types/node`.

## Deviations from Design

- Task order 1.2/1.3 swapped in practice: the CLI requires a valid `@/*` alias BEFORE init, so alias wiring (1.3) was applied first, then init (1.2) completed. Same work unit, no scope change.
- Added `@types/node` (dev) so the `node:path`-based alias in `vite.config.ts`/`vitest.config.ts` type-checks (repo had no node types).
- Actual deps differ from the proposal's assumed Radix/`clsx` set: CLI defaults installed the Base UI base (`@base-ui/react`) and the `cn` package instead of `clsx`+`tailwind-merge`; `shadcn` CLI landed in `dependencies`. Recorded here so the rollback plan uses the real list. Icon library default accepted (`lucide-react`), preset default accepted (`nova`), tab label question untouched (Unit 3 scope).

## Issues Found

- `src/lib/sync.test.ts` ("is a no-op without credentials") fails when the gitignored local `.env` (with real `VITE_SUPABASE_URL`/`KEY`) is present, because `src/lib/supabase.ts` reads `import.meta.env` (populated from `.env`) while the test only stubs `process.env`. Proven environmental and pre-existing: 32/32 green with `.env` moved aside (both before and after Unit 1), identical single failure with it present, tracked tree untouched. Flagged for verify/Unit 2: either document "run gate without local `.env`" or make the test clear `import.meta.env` state. NOT fixed here (out of Unit 1 scope; no domain/test edits allowed).

## Remaining Tasks (NOT started — Unit 3)

- [ ] Phase 4: `PadronView` table + `App.tsx` shadcn `Tabs` (TDD)
- [ ] Phase 5: Regression gate + `pnpm dev` smoke

## Unit 2 — ageGroups + DashboardView (PR2 slice, stacked-to-main)

- Scope: Phase 2 (2.1 RED → 2.2 GREEN) + Phase 3 (3.1 RED → 3.2 GREEN → 3.3 REFACTOR)
- Safety net: full `pnpm test` before changes → 31 passed / 1 pre-existing env failure (`sync.test.ts` "without credentials", local `.env` present — same as Unit 1 baseline). New files only, so no existing behavior at risk.

### Completed Tasks (Phases 2–3)

- [x] 2.1 RED: `src/lib/ageGroups.test.ts` (23→6-23, 24→older, empty, mixed) — failed to collect (`Failed to resolve import "./ageGroups"`)
- [x] 2.2 GREEN: `src/lib/ageGroups.ts` — 4/4 green, no refactor needed (pure, minimal)
- [x] 3.1 RED: `src/components/DashboardView.test.tsx` (seeded KPIs, 4 Hb bars, 2 age bars, empty `—` + Sin registros, fixed-size hook) — failed to collect (`Failed to resolve import "./DashboardView"`)
- [x] 3.2 GREEN: `src/components/DashboardView.tsx` — 4/4 green after one legit GREEN fix (see Issues)
- [x] 3.3 REFACTOR: extracted exported pure `toHbBandData` + unit test; `CardHeader/Title/Content`, semantic tokens, `cn()`, `flex/grid gap-*` confirmed — 5/5 green

### TDD Cycle Evidence (Strict TDD hard gate)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1–2.2 | `src/lib/ageGroups.test.ts` | Unit | N/A (new file) | ✅ Missing-module import failure | ✅ 4/4 pass | ✅ 4 cases (boundary 23/24, empty, mixed) | ➖ None needed (pure minimal) |
| 3.1–3.2 | `src/components/DashboardView.test.tsx` | Integration (Testing Library + store) | ✅ 31/32 (1 pre-existing env fail, reported not fixed) | ✅ Missing-module import failure | ✅ 4/4 pass (after `isAnimationActive={false}` impl fix) | ✅ 4 scenarios (KPIs, Hb bars, age bars, empty) | ✅ `toHbBandData` extracted, 5/5 pass |

### Test Summary

- **Total tests written**: 9 (4 ageGroups + 5 DashboardView incl. `toHbBandData` unit)
- **Total tests passing**: 9/9 focused; full suite 40 passed / 1 pre-existing env failure (41 total)
- **Layers used**: Unit (5), Integration (4), E2E (0)
- **Approval tests** (refactoring): None — no refactoring tasks (new code only)
- **Pure functions created**: 2 (`groupByAgeBand`, `toHbBandData`)

### Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command and exact result | `pnpm vitest run src/components/DashboardView.test.tsx src/lib/ageGroups.test.ts` → 2 files passed, 9/9 green. `pnpm tsc --noEmit` → exit 0. Full `pnpm test` → 40 passed / 1 failed (pre-existing `sync.test.ts` env failure only). |
| Runtime harness command/scenario and exact result | N/A — no runtime boundary beyond component render: DashboardView is not yet wired into `App.tsx` (Unit 3 owns Tabs wiring), so `pnpm dev` smoke belongs to the Unit 3 gate per tasks Phase 5. Render path is fully covered by the jsdom integration tests above. |
| Rollback boundary | New files: `src/lib/ageGroups.ts`, `src/lib/ageGroups.test.ts`, `src/components/DashboardView.tsx`, `src/components/DashboardView.test.tsx`. Rollback: delete those 4 files. `StatisticsView.tsx`, `App.tsx`, `PadronView.tsx` untouched. |

### Files Changed (Unit 2)

| File | Action | What Was Done |
|------|--------|---------------|
| `src/lib/ageGroups.ts` | Created | `AgeBand` type + pure `groupByAgeBand` (`<24` → 6-23, else 24-59); outside `domain/anemia.ts` |
| `src/lib/ageGroups.test.ts` | Created | 4 boundary/empty/mixed cases |
| `src/components/DashboardView.tsx` | Created | 4 KPI `Card`s (total/avg/%anemia/mod+sev), 4 `Badge` band-count cards via `DIAGNOSIS_BADGE`, fixed-size (`320×200`, no `ResponsiveContainer`) Hb + age `BarChart`s with `LabelList` counts, empty `—` + Sin registros |
| `src/components/DashboardView.test.tsx` | Created | Seeded-store KPIs (5 patients: total 5, avg 9.80, 60%, mod+sev 2), 4 Hb labels + counts (2/1/1/1), age bands (3/2, boundary 24→older), empty state, SVG width/height + no-responsive-container hook, `toHbBandData` unit |
| `openspec/changes/anemia-dashboard/tasks.md` | Modified | Phase 2–3 tasks checked |
| `openspec/changes/anemia-dashboard/apply-progress.md` | Modified | This file (merged Unit 1 + Unit 2) |

### Deviations from Design

- `StatisticsView.tsx` NOT deleted (task 3.2 said delete). Reason: `App.tsx` + `App.test.tsx` + `StatisticsView.test.tsx` still import it; deleting now breaks `tsc` and the full suite with zero benefit. Deletion moves to Unit 3, which owns the `App` Tabs migration to `DashboardView`. `DashboardView` coexists untouched alongside it.
- Charts use raw Recharts primitives (`BarChart`/`Bar`/`XAxis`/`YAxis`/`LabelList`/`Tooltip`) with fixed `width`/`height` instead of shadcn `ChartContainer`: `ChartContainer` always renders a `ResponsiveContainer`, which is exactly what the fixed-size test strategy (design decision) rejects for jsdom. Semantic tokens still used via `fill="var(--color-chart-*)"` per shadcn chart convention; `Card`/`Badge` composition follows the shadcn skill rules.
- KPI set extends the spec's "total, avg, per-band" with `% con anemia` and `Moderada + Severa` per the assignment brief; per-band counts are `Badge` cards (which also satisfies the `DIAGNOSIS_BADGE` design requirement).

### Issues Found

- GREEN fix (implementation, not test): Recharts v3 animates `Bar` labels, so `LabelList` counts do not exist in the jsdom DOM on first render. Fixed with `isAnimationActive={false}` on both bars — deterministic render, no animation nor `ResizeObserver` dependency in tests. Worth keeping in production (dashboard charts render instantly).
- `YAxis` uses `hide`: axis tick labels would duplicate `LabelList` counts as text nodes and weaken count assertions; direct bar labels carry the values instead.
- Env note (unchanged from Unit 1): full suite is 40/41 with local `.env` present; the single failure is the pre-existing `sync.test.ts` "without credentials" case. NOT touched (out of Unit 2 scope).

## Workload / PR Boundary

- Mode: chained PR slice (auto-chain, stacked-to-main)
- Current work unit: Unit 2 — ageGroups + DashboardView (PR2)
- Boundary: starts at Unit 1 foundation (uncommitted on `slice-3-sync`); ends with helper + dashboard tested green, tsc clean
- Estimated review budget impact: ~330 hand-written lines (2 source + 2 test files), well within the 400-line budget for this slice

## Status

4/4 Phase 1 + 2/2 Phase 2 + 3/3 Phase 3 tasks complete. Ready for next batch (Unit 3: PadronView + App Tabs + gate). Uncommitted on `slice-3-sync`; orchestrator owns commit/PR creation.

## Unit 3 — PadronView table + App Tabs + gate (PR3 slice, stacked-to-main)

- Scope: Phase 4 (4.1 RED → 4.2 GREEN → 4.3 Tabs) + Phase 5 (5.1 gate + 5.2 smoke)
- Safety net: `pnpm vitest run src/components/PadronView.test.tsx src/App.test.tsx src/components/StatisticsView.test.tsx` before changes → 7/7 green. `StatisticsView.tsx` + `StatisticsView.test.tsx` deleted (Unit 2 deferral resolved); `DashboardView`/`ageGroups`/sync untouched.

### Completed Tasks (Phases 4–5)

- [x] 4.1 RED: extended `src/components/PadronView.test.tsx` (4→7: table + badges per row, filter narrows, case-insensitive match, "Sin resultados", empty CTA with `onEmptyRegister` mock, edit/delete round-trip via `tr` rows) — 7/7 failed on old `<ul>` markup (genuine RED)
- [x] 4.2 GREEN: rewrote `src/components/PadronView.tsx` (`Table` + single `Input` filter over `nombre` via local `useState`, `Badge` via shared `DIAGNOSIS_BADGE`, edit form as `colSpan` row reusing `update` validation, `remove` kept) — 7/7 green
- [x] 4.3 RED→GREEN: rewrote `src/App.test.tsx` (tab roles, Dashboard KPI via `kpi-total`, empty-CTA navigation) — 2/2 failed on old hand tabs, then migrated `src/App.tsx` to shadcn `Tabs` (controlled `value`, `TabsTrigger` inside `TabsList`, values `register|padron|dashboard`, labels Registro/Padrón/Dashboard) — 2/2 green; deleted `StatisticsView.tsx` + `StatisticsView.test.tsx`
- [x] 5.1 Gate: `pnpm tsc --noEmit` exit 0; full suite 43/43 green clean-env, 42/43 with local `.env` (single known pre-existing `sync.test.ts` env failure); Unit 3 files free of ad-hoc colors and `space-*`
- [x] 5.2 Smoke: `pnpm dev --port 1420` → `curl` HTTP 200 with shell title (boot only; filter/badge/edit/delete paths covered by jsdom integration tests)

### TDD Cycle Evidence (Strict TDD hard gate)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.1–4.2 | `src/components/PadronView.test.tsx` | Integration (Testing Library + store) | ✅ 7/7 on touched files | ✅ 7/7 fail on old markup | ✅ 7/7 pass | ✅ 7 cases (narrows + case-insensitive + no-match + CTA + badges + edit + delete) | ✅ `COLUMN_COUNT` const, shared badge map, `colSpan` edit row, semantic tokens |
| 4.3 | `src/App.test.tsx` | Integration (Testing Library + store) | ✅ 7/7 on touched files | ✅ 2/2 fail (no tab roles/Dashboard/CTA) | ✅ 2/2 pass | ✅ 2 scenarios (register→padrón→dashboard, CTA→Registro) | ➖ None needed (declarative Tabs map) |

### Test Summary

- **Total tests written**: 9 (7 PadronView incl. 3 new + 2 App incl. 1 new)
- **Total tests passing**: 9/9 focused; full suite 43/43 clean-env, 42/43 with local `.env` (pre-existing env failure only)
- **Layers used**: Unit (0), Integration (9), E2E (0)
- **Approval tests** (refactoring): existing PadronView/App tests rewritten to the new spec-driven markup (behavior intentionally changed per `padron-table` spec); old assertions superseded, not preserved
- **Pure functions created**: 0 (filter is 3-line inline `includes`; extraction adds no branch coverage)

### Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command and exact result | `pnpm vitest run src/App.test.tsx src/components/PadronView.test.tsx` → 2 files passed, 9/9 green. `pnpm tsc --noEmit` → exit 0. |
| Runtime harness command/scenario and exact result | `pnpm dev --port 1420 --host 127.0.0.1` + `curl http://127.0.0.1:1420/` → HTTP 200 with app shell. No stray `vite` process left (verified via process list). Filter/badge/edit/delete/tabs paths covered by the jsdom integration tests above. |
| Rollback boundary | Modified: `src/components/PadronView.tsx`, `src/components/PadronView.test.tsx`, `src/App.tsx`, `src/App.test.tsx`. Deleted: `src/components/StatisticsView.tsx`, `src/components/StatisticsView.test.tsx`. Rollback: `git checkout -- src/components/PadronView.tsx src/App.tsx` (tests are new-behavior, discard with `git checkout --` on test files too); restore StatisticsView pair via `git checkout -- src/components/StatisticsView.tsx src/components/StatisticsView.test.tsx`. No other file depends on the new code. |

### Files Changed (Unit 3)

| File | Action | What Was Done |
|------|--------|---------------|
| `src/components/PadronView.tsx` | Rewritten | `Table` (Nombre/Edad/Hb/Diagnóstico/Acciones) + `Input` filter (`nombre` includes, case-insensitive) + `Badge` via `DIAGNOSIS_BADGE` from `DashboardView`; `Sin resultados` no-match row; empty state with `Registrar paciente` CTA (`onEmptyRegister?` prop); edit `colSpan` row + `update`/`remove` kept; `Button` variants, semantic tokens, `flex gap-*` |
| `src/components/PadronView.test.tsx` | Rewritten | 7 integration tests (table/badges, narrows, case-insensitive, no-match, empty CTA mock, edit recompute, delete) |
| `src/App.tsx` | Rewritten | Hand tabs → shadcn `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`; third tab renamed Estadísticas→Dashboard rendering `DashboardView`; CTA wired to `setTab("register")` |
| `src/App.test.tsx` | Rewritten | Register→padrón(table+badges)→dashboard(KPI) flow + CTA navigation |
| `src/components/StatisticsView.tsx` | Deleted | Superseded by `DashboardView` (Unit 2 deferral resolved; no remaining importers) |
| `src/components/StatisticsView.test.tsx` | Deleted | Covered by `DashboardView.test.tsx`; would fail without its subject |
| `openspec/changes/anemia-dashboard/tasks.md` | Modified | Phase 4–5 tasks checked |
| `openspec/changes/anemia-dashboard/apply-progress.md` | Modified | This file (merged Units 1+2+3) |

### Deviations from Design

- Filter matches `nombre` only. Spec text says "name or document" but `Paciente` has no document field — there is nothing to match against, so normalized `includes` over `nombre` is the full implementation. No schema change (out of scope).
- Third tab labeled `Dashboard` per assignment (`Estadísticas→Dashboard`); `DashboardView` keeps its `Panel` heading from Unit 2 (untouched per scope guard). Spec-neutral per design open question.
- `DIAGNOSIS_BADGE` imported from `./DashboardView` (single source) instead of duplicating the map in `PadronView`. Accepts a view-to-view import; alternative was a new shared module (rejected: extra file for a 4-entry map).
- `RegisterForm.tsx` still uses `space-y-4`, `text-red-600`, `bg-blue-600` — out of Unit 3 scope, untouched. Flagged for whichever unit owns the form migration.
- `.env` handling: gate recorded both with (42/43, known failure) and without (43/43) local `.env`. The file was moved aside and restored, never committed (gitignored; `git status` shows no `.env` entry).

### Issues Found

- `pkill -f vite` hangs this shell session (pattern matches the wrapper itself); worked around by verifying via process-list snapshot that no `vite` process remained after the smoke. Future smokes should capture the dev PID via `$!`/`echo` and `kill <pid>`.
- Env note (unchanged from Units 1–2): single `sync.test.ts` "without credentials" failure with local `.env` present is pre-existing and untouched.

## Workload / PR Boundary

- Mode: chained PR slice (auto-chain, stacked-to-main)
- Current work unit: Unit 3 — PadronView table + App Tabs + gate (PR3)
- Boundary: starts at Unit 2 dashboard (uncommitted on `slice-3-sync`); ends with filterable table + Tabs + StatisticsView removed + gate evidence
- Estimated review budget impact: ~330 hand-written lines (2 source rewrites + 2 test rewrites, 2 deletions), within the 400-line budget for this slice

## Status

4/4 Phase 1 + 2/2 Phase 2 + 3/3 Phase 3 + 3/3 Phase 4 + 2/2 Phase 5 tasks complete (14/14). STOP after Unit 3 per assignment. Uncommitted on `slice-3-sync`; orchestrator owns commit/PR creation. Ready for verify (`sdd-verify`).
