# Proposal: anemia-dashboard

## Intent

Replace hand-rolled tabs/inputs and text-only stats with shadcn dashboard: KPI cards, Hb chart, risk-by-age, filterable padron table. Prior TAR context (reference only): `TAR/openspec/changes/archive/2026-10-03-anemia-despistaje-app`.

## Scope

### In Scope
- `shadcn init` (Tailwind v4): `components.json`, `cn()`, semantic tokens; add `button, card, table, input, badge, tabs, chart`
- `App.tsx` to shadcn `Tabs`; `StatisticsView` to dashboard (KPIs, Hb 4-band bars, age 6-23 vs 24-59)
- `PadronView` to `Table` + single `Input` filter + `Badge` labels; keep edit/delete
- Spanish UI, English code, minimalist style; TDD helpers + fixed-size chart tests

### Out of Scope
- Supabase live counts (deferred, offline-first Zustand stays)
- Sorting, pagination, multi-filters, TanStack Table; new domain rules

## Capabilities

### New Capabilities
- `dashboard`: KPIs, Hb distribution chart, risk-by-age grouping
- `padron-table`: filterable table, badge labels, row actions

### Modified Capabilities
- None (empty `openspec/specs/`)

## Approach

Approach 1: `shadcn init` + shadcn `Chart` (Recharts) + hand single-filter `Table`. Branch `slice-3-sync` tip; stacked-to-main. Hand code ~500-650 lines; `ui/*` excluded from 800-line budget.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/index.css` | Modified | Token rewrite, 1 line |
| `components.json`, `src/components/ui/*` | New | Generated sources |
| `tsconfig.json`, `vite.config.ts` | Modified | `@/*` alias |
| `package.json` | Modified | New deps |
| `src/App.tsx`, `StatisticsView.tsx`, `PadronView.tsx` | Modified | Tabs, dashboard, table |
| `src/domain/anemia.ts`, `stores/`, `lib/` | Read-only | Reuse selectors |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `index.css` regression | Low | `git checkout` rollback |
| Alias breaks build | Low | Gate `tsc` + `vitest` |
| Recharts in jsdom | Med | Fixed sizes in tests |
| Slice-stack drift | Med | Rebase on `slice-3-sync` |
| Scope creep | Med | Out of Scope enforced |

## Rollback Plan

- `index.css`: `git checkout -- src/index.css`.
- Delete `src/components/ui/*` + `components.json`; uninstall `recharts`, `@radix-ui/*`, `clsx`, `tailwind-merge`, `class-variance-authority`.
- Revert alias diff; gate on `tsc --noEmit` + `vitest run` green.

## Dependencies

- `recharts`, `@radix-ui/*`, `clsx`, `tailwind-merge`, `class-variance-authority`, icon lib default
- Base `slice-3-sync` tip; 32 tests green

## Success Criteria

- [ ] `tsc --noEmit` + `vitest run` pass on existing selectors
- [ ] KPIs, Hb bars, risk-by-age render; table filters, badges, edit/delete work
- [ ] Semantic tokens, `cn()`, Card/Tabs composition; no ad-hoc colors
- [ ] Spanish UI, English code; hand diff in budget (`ui/*` excluded)
