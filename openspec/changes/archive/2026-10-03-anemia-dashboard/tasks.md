# Tasks: anemia-dashboard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500-650 hand-written (ui/* generated excluded) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 foundation → PR2 helpers+dashboard → PR3 padron+tabs+gate |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | shadcn foundation (tokens, alias, cn) | PR1 | `pnpm tsc --noEmit && pnpm test` | `pnpm dev` shell loads, N/A scenario beyond boot | Revert `src/index.css`, `tsconfig.json`, `vite.config.ts`; delete `components.json`+`ui/*` |
| 2 | ageGroups + DashboardView KPIs/charts | PR2 | `pnpm test src/lib/ageGroups.test.ts src/components/DashboardView.test.tsx` | `pnpm dev` / Panel tab: KPIs + 2 charts | Delete `src/lib/ageGroups.ts` + `src/components/DashboardView.tsx` |
| 3 | PadronView table + App Tabs + gate | PR3 | `pnpm test src/components/PadronView.test.tsx && pnpm test` | `pnpm dev` filter/badge/edit/delete; full suite 32+new green | Revert `src/components/PadronView.tsx`, `src/App.tsx`; restore `StatisticsView.tsx` |

## Phase 1: Foundation (shadcn init)

- [x] 1.1 Rebase onto `slice-3-sync` tip; confirm `pnpm test` 32 green baseline
- [x] 1.2 Run shadcn init (Tailwind v4): create `components.json`, `src/lib/utils.ts` (`cn()`), `src/components/ui/*` (button, card, table, input, badge, tabs, chart)
- [x] 1.3 Rewrite `src/index.css` tokens; add `@/*` alias in `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`; add deps in `package.json`
- [x] 1.4 Gate: `pnpm tsc --noEmit && pnpm test` green

## Phase 2: Presentation helper (TDD)

- [x] 2.1 RED: create `src/lib/ageGroups.test.ts` (23→6-23, 24→24-59, empty, mixed counts)
- [x] 2.2 GREEN: implement `groupByAgeBand` in `src/lib/ageGroups.ts` per contract

## Phase 3: DashboardView (TDD)

- [x] 3.1 RED: create `src/components/DashboardView.test.tsx` (seeded store KPIs, 4 Hb bars, 2 age bars, empty `—` state, fixed-size hook)
- [x] 3.2 GREEN: create `src/components/DashboardView.tsx` (KPI `Card`s, Recharts `Chart` fixed width/height, `DIAGNOSIS_BADGE` map); delete `src/components/StatisticsView.tsx` — DEFERRED to Unit 3 (see apply-progress)
- [x] 3.3 REFACTOR: extract `toHbBandData` pure mapper; enforce `CardHeader/Title/Content`, tokens, `cn()`

## Phase 4: Padron table + Tabs wiring (TDD)

- [x] 4.1 RED: extend `src/components/PadronView.test.tsx` (filter narrows, "Sin resultados", badges per row, edit/delete round-trip, empty CTA)
- [x] 4.2 GREEN: rewrite `src/components/PadronView.tsx` (`Table`+`Input`+`Badge`, local `useState` filter, keep `update`/`remove`)
- [x] 4.3 Migrate `src/App.tsx` hand tabs → shadcn `Tabs` (`TabsList`/`TabsTrigger`); Spanish labels, English identifiers

## Phase 5: Regression gate

- [x] 5.1 Run `pnpm tsc --noEmit && pnpm test` (32 prior + new green); verify no ad-hoc colors, no `space-*`
- [x] 5.2 Manual `pnpm dev` smoke: Panel KPIs/charts, padrón filter/badges/actions
