# Apply Progress: dashboard-shell — Unit 1 + Unit 2 + Unit 3 (MERGED)

**Change**: dashboard-shell
**Mode**: Strict TDD (Units 2–3) — RED→GREEN evidence below; Unit 1 was Standard/provisioning (generated code, gate-as-evidence)
**Scope**: Phase 1 (tasks 1.1–1.2) + Phase 2 (tasks 2.1–2.4) + Phase 3 (tasks 3.1–3.3) + Phase 4 (tasks 4.1–4.2). All 10 tasks complete.
**Branch**: slice-3-sync
**Date**: 2026-10-04

## Completed Tasks

- [x] 1.1 Run `pnpm dlx shadcn@latest add sidebar` non-interactively; fix `next/` imports if leaked in `src/components/ui/sidebar.tsx`
- [x] 1.2 Gate: `pnpm test` green and `pnpm build` (`tsc --noEmit`) green before shell work
- [x] 2.1 RED: extend `src/App.test.tsx` — menu navigates 3 views, exactly one `aria-current`, no `TabsTrigger` in DOM
- [x] 2.2 GREEN: create `src/components/app-sidebar.tsx` (`AppSidebar({active, onNavigate})`, lucide icons, Spanish labels)
- [x] 2.3 GREEN: rewrite `src/App.tsx` — `SidebarProvider` + `AppSidebar` + `SidebarInset`, reuse `TabId`, content `max-w-5xl`
- [x] 2.4 RED→GREEN: collapse-to-icons toggle and mobile overlay-dismiss tests in `src/App.test.tsx`
- [x] 3.1 RED: extend `src/components/DashboardView.test.tsx` — each KPI card shows value + exactly one Spanish caption; empty-store case
- [x] 3.2 GREEN: add pure `captionFor()` helpers + `CardDescription` captions in `src/components/DashboardView.tsx`; selectors only, no store change
- [x] 3.3 Verify selector-only rule: values trace to `pacientes`, `countByDiagnosis`, `averageHb`; chart JSX untouched
- [x] 4.1 Bars byte-identical check: `hb-chart`/`age-chart` (320×200, no ResponsiveContainer) assertions unchanged in `DashboardView.test.tsx`
- [x] 4.2 Full gate: `pnpm test` + `pnpm build` green; confirm no data-table/palette/auth code added

## Unit 1 — What Was Done (preserved from prior batch)

Provisioned the sidebar primitive via CLI, non-interactive (`pnpm dlx shadcn@latest add sidebar -y`). No hand-written primitive — CLI succeeded, no fallback invented.

New files (CLI-generated):

| File | Action | Notes |
|------|--------|-------|
| `src/components/ui/sidebar.tsx` | Created (CLI) | Base UI primitive; `@/` aliases correct for Vite |
| `src/components/ui/sheet.tsx` | Created (CLI dep) | Sheet overlay dep for sidebar mobile off-canvas |
| `src/components/ui/separator.tsx` | Created (CLI dep) | Already-matching pattern |
| `src/components/ui/skeleton.tsx` | Created (CLI dep) | Already-matching pattern |
| `src/components/ui/tooltip.tsx` | Created (CLI dep) | Tooltip dep for collapsed icon mode |
| `src/hooks/use-mobile.ts` | Created (CLI dep) | `useIsMobile` hook used by sidebar |

Skipped (identical, not overwritten): `src/components/ui/button.tsx`, `src/components/ui/input.tsx`.
No `package.json` change — `@base-ui/react`, `lucide-react`, `class-variance-authority` already satisfied.

Import leakage check: `grep -rn "from ['\"]next/"` over all 6 new files — no matches. `@/` aliases match `vite.config.ts`/`tsconfig.json`. `"use client"` harmless under Vite; `tsc` clean.

Unit 1 evidence: `pnpm test` → 71/71; `pnpm exec tsc --noEmit` → exit 0; `pnpm build` → success.

## Unit 2 — What Was Done

Strict TDD, safety net first: `src/App.test.tsx` baseline 2/2 passing (Tabs version) before rewrite.

**RED**: rewrote `src/App.test.tsx` (6 tests) against behavior that did not exist — `getByRole("navigation")`, `Panel` button, `aria-current="page"`, collapse `data-state`, mobile overlay dismiss. Result: **6/6 FAILED** (5× no `navigation` role since App still used Tabs; mobile test failed at Toggle Sidebar). Genuine RED, not vacuous.

**GREEN**:
- `src/components/app-sidebar.tsx` (created, hand-written): exports `TabId` as the single nav source (moved out of `App.tsx` per design "moved import if needed"), `NAV_ITEMS` with Spanish labels (Registro/Padrón/Panel) + lucide icons passed as objects (`ClipboardList`, `Users`, `LayoutDashboard`), `AppSidebar({active, onNavigate})` composing `Sidebar(collapsible="icon") > SidebarContent > SidebarGroup > SidebarGroupContent > nav[aria-label=Principal] > SidebarMenu > SidebarMenuItem > SidebarMenuButton(isActive, aria-current="page", tooltip=label)`. `onNavigate` + `setOpenMobile(false)` gives mobile overlay dismiss. No sizing classes on icons; `gap-*` header layout; semantic tokens only.
- `src/App.tsx` (rewritten): `SidebarProvider + AppSidebar + SidebarInset`; header with `SidebarTrigger` + title; content `mx-auto w-full max-w-5xl`; conditional view render, **zero Tabs imports**; `TabId` imported from `app-sidebar`.
- One RED-round fix: sidebar primitive renders `div`s, not `nav` — added explicit `<nav aria-label="Principal">` wrapper (semantic, not implementation-coupled). One test correction during GREEN: empty-store mobile test asserts the empty-padrón CTA (not a table) plus dialog dismissal.

**TRIANGULATE**: 6 tests triangulate nav (all 3 views × active-switching assertions), single-active invariant, no-Tabs invariant, collapse→navigate-while-collapsed→expand, mobile open→select→dismiss. Every assertion invokes production code and asserts spec-derived values.

**REFACTOR**: none needed — minimal hand code, no duplication, no magic values. Tests green after each edit.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | N/A (CLI provision) | N/A | N/A (new files) | N/A (generated) | ✅ Gates green | ➖ Single (no branching) | ➖ None needed |
| 1.2 | Full suite | Unit+Integration | ✅ 71/71 baseline preserved | N/A (gate task) | ✅ 71/71 + tsc 0 | ➖ Gate only | ➖ None needed |
| 2.1 | `src/App.test.tsx` | Integration | ✅ 2/2 Tabs baseline | ✅ 6/6 failed | ✅ 6/6 passed | ✅ 6 cases (3 views + active + no-tabs + offline flow) | ➖ None needed |
| 2.2 | `src/App.test.tsx` | Integration | ✅ 2/2 | ✅ covered by 2.1 RED | ✅ 6/6 passed | ✅ nav + active + tooltip/collapsed path | ➖ None needed |
| 2.3 | `src/App.test.tsx` | Integration | ✅ 2/2 | ✅ covered by 2.1 RED | ✅ 6/6 passed | ✅ shell layout via view-render assertions | ➖ None needed |
| 2.4 | `src/App.test.tsx` | Integration | ✅ 2/2 | ✅ Toggle/dismiss absent (RED run) | ✅ 6/6 passed | ✅ collapse both directions + mobile dismiss | ➖ None needed |

### Test Summary
- **Total tests written**: 6 (App.test.tsx rewritten; 2 legacy Tabs tests replaced)
- **Total tests passing**: 75/75 full suite (10 files), `tsc --noEmit` exit 0, `pnpm build` success
- **Layers used**: Integration (6)
- **Approval tests** (refactoring): None — shell swap, not refactor; legacy behavior re-covered by rewritten tests
- **Pure functions created**: 0 (component composition task; `NAV_ITEMS` is a constant map)

## Work Unit Evidence (Unit 2)

| Evidence | Value |
|----------|-------|
| Focused test command and exact result | `pnpm test src/App.test.tsx` → 1 file passed, **6/6 tests passed** |
| Full gate | `pnpm test` → 10 files, **75/75 passed**; `pnpm exec tsc --noEmit` → exit 0; `pnpm build` → success (~13s) |
| Runtime harness command/scenario and exact result | N/A — no interactive runtime run in this environment; behavior covered by jsdom integration tests (nav clicks, collapse toggle, mobile overlay open/select/dismiss) + successful production bundle |
| Rollback boundary | Revert `src/App.tsx` to Tabs version (VCS) + delete `src/components/app-sidebar.tsx` + restore prior `src/App.test.tsx` — Unit 1 primitive files untouched |

## Deviations from Design

- `TabId` moved from `App.tsx` into `app-sidebar.tsx` (design allowed: "moved import if needed") — keeps single source without a circular type import.
- Added explicit `<nav aria-label="Principal">` around `SidebarMenu` — the CLI primitive renders `div`s, so semantic landmark needed a hand wrapper. No primitive modified.
- Dashboard label is "Panel" per assignment (Spanish nav labels); `TABS` constant removed with Tabs.

None other — implementation matches design (icon-collapsible provider use, `SidebarTrigger`, `max-w-5xl`, selector/store untouched).

## Issues Found

None blocking. Note: jsdom lacks `window.matchMedia`, which `useIsMobile` requires — tests mock `matchMedia` + `innerWidth` per viewport (desktop default, mobile case). No production change needed. Tablet-width collapse default accepted as provider default per design open question.

## Remaining Tasks (NOT touched — next batches)

- [x] Phase 3: Section-Cards Captions (tasks 3.1–3.3) — Unit 3 DONE
- [x] Phase 4: Regression and Verification (tasks 4.1–4.2) DONE

## Unit 3 — What Was Done (cards + regression)

Strict TDD, captions first: `src/components/DashboardView.test.tsx` baseline 5/5 passing (KPI values, bars, empty, toHbBandData) before extension.

**RED**: extended `src/components/DashboardView.test.tsx` (+4 tests: 2 caption-DOM + 2 `captionFor` unit) against a helper that did not exist. Result: **4/9 FAILED** (`captionFor is not a function` ×4; existing 5 passed). Genuine RED, not vacuous.

**GREEN**:
- `src/components/DashboardView.tsx` (modified, hand-written diff only): exported `KpiMetric` type + pure `captionFor(metric, empty)` returning 8 Spanish strings (4 trend + 4 empty-state); `CardDescription` added inside each of the 4 KPI `CardHeader`s (full Card composition per shadcn rule); legacy conditional `Sin registros` paragraph under avg removed (now the avg empty caption, keeping exactly one caption line per card). Selector lines (`pacientes`, `countByDiagnosis`, `averageHb`) and all value math untouched; chart JSX (both `BarChart 320×200` blocks) byte-identical — confirmed via `git diff` showing zero hunks in chart section.
- One RED-round test correction during GREEN: legacy empty-state assertion `getByText(/sin registros/i)` now matches 2 captions (total + avg) → widened to `getAllByText(...).length >= 1`. Intent preserved.
- New tests: seeded captions per card (title→caption pairs, exactly one `[data-slot='card-description']` per card), empty-state captions per card, `captionFor` unit tests for all 8 strings.

**TRIANGULATE**: 9 tests triangulate values (seeded 5-patient fixture avg 9.80, 60%, modsev 2), captions (4 seeded + 4 empty + 8 unit strings), single-caption invariant per card, bars regression (band labels, counts, 320×200, no ResponsiveContainer), empty state.

**REFACTOR**: none needed — pure helper with exhaustive switches, no duplication.

### Test Summary (Unit 3)
- **Total tests written**: 4 (2 caption-DOM integration + 2 captionFor unit)
- **Total tests passing**: 9/9 focused (`DashboardView.test.tsx`); 79/79 full suite (10 files)
- **Layers used**: Integration (7) + Unit (2, captionFor pure)
- **Approval tests**: None — additive captions, not refactor; bars covered by unchanged regression tests

## TDD Cycle Evidence (merged)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | N/A (CLI provision) | N/A | N/A (new files) | N/A (generated) | ✅ Gates green | ➖ Single (no branching) | ➖ None needed |
| 1.2 | Full suite | Unit+Integration | ✅ 71/71 baseline preserved | N/A (gate task) | ✅ 71/71 + tsc 0 | ➖ Gate only | ➖ None needed |
| 2.1 | `src/App.test.tsx` | Integration | ✅ 2/2 Tabs baseline | ✅ 6/6 failed | ✅ 6/6 passed | ✅ 6 cases (3 views + active + no-tabs + offline flow) | ➖ None needed |
| 2.2 | `src/App.test.tsx` | Integration | ✅ 2/2 | ✅ covered by 2.1 RED | ✅ 6/6 passed | ✅ nav + active + tooltip/collapsed path | ➖ None needed |
| 2.3 | `src/App.test.tsx` | Integration | ✅ 2/2 | ✅ covered by 2.1 RED | ✅ 6/6 passed | ✅ shell layout via view-render assertions | ➖ None needed |
| 2.4 | `src/App.test.tsx` | Integration | ✅ 2/2 | ✅ Toggle/dismiss absent (RED run) | ✅ 6/6 passed | ✅ collapse both directions + mobile dismiss | ➖ None needed |
| 3.1 | `src/components/DashboardView.test.tsx` | Integration+Unit | ✅ 5/5 baseline | ✅ 4/9 failed (`captionFor is not a function`) | ✅ 9/9 passed | ✅ 4 cards × value+caption, empty ×4, 8 unit strings | ➖ None needed |
| 3.2 | `src/components/DashboardView.test.tsx` | Integration+Unit | ✅ 5/5 | ✅ covered by 3.1 RED | ✅ 9/9 passed | ✅ CardDescription slot invariant per card | ➖ None needed |
| 3.3 | `src/components/DashboardView.tsx` diff | Static review | ✅ selectors intact | N/A (rule check) | ✅ values trace to 3 selectors, no store edit | ✅ `git diff` shows no chart hunks | ➖ None needed |
| 4.1 | `src/components/DashboardView.test.tsx` bars tests | Regression | ✅ pre-existing | N/A (unchanged) | ✅ passed unmodified | ✅ band labels + counts + 320×200 + no-ResponsiveContainer | ➖ None needed |
| 4.2 | Full suite + build | Gate | ✅ 75/75 prior | N/A (gate task) | ✅ 79/79 + tsc 0 + build ok | ➖ Gate only | ➖ None needed |

## Work Unit Evidence (Unit 3)

| Evidence | Value |
|----------|-------|
| Focused test command and exact result | `pnpm test src/components/DashboardView.test.tsx` → 1 file passed, **9/9 tests passed** |
| Full gate | `pnpm test` → 10 files, **79/79 passed**; `pnpm exec tsc --noEmit` → exit 0; `pnpm build` → success (~12s) |
| Runtime harness command/scenario and exact result | N/A — no interactive runtime run in this environment; behavior covered by jsdom integration tests (seeded + empty caption rendering, CardDescription slot invariant) + successful production bundle |
| Rollback boundary | Single-file revert `src/components/DashboardView.tsx` (+ restore prior `DashboardView.test.tsx` empty assertion) — App shell / Unit 1–2 files untouched |

## Workload / PR Boundary

- Mode: chained PR slice (auto-chain, stacked-to-main per tasks.md forecast)
- Current work unit: Unit 2 — shell + TabId nav (intended PR 2)
- Boundary: starts after Unit 1 primitive provision; ends after App shell swap + 6/6 nav tests + full 75/75 gate; DashboardView/tests untouched
- Estimated review budget impact: hand diff is 2 files (1 created ~70 lines, 1 rewritten ~40 lines) + test file (~170 lines) — well within budget; generated `ui/*` excluded per forecast

## Status

10/10 tasks complete (Phases 1–4 done). STOP after Unit 3 gate per assignment. Ready for verify.
