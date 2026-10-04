# Tasks: dashboard-shell

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 300–400 hand + ~500 generated (`ui/sidebar.tsx` excluded) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 primitive → PR 2 shell → PR 3 cards + regression |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | CLI-provision `ui/sidebar.tsx` primitive, tsc+tests green | PR 1 | `pnpm test` + `pnpm build` | N/A (non-interactive provision, no behavior) | Delete `ui/sidebar.tsx` + auto-added dep files |
| 2 | Shell + `TabId` nav, collapsible + mobile | PR 2 | `pnpm test src/App.test.tsx` | `pnpm dev` — click Registro/Padrón/Panel, toggle collapse | Revert `App.tsx` + delete `app-sidebar.tsx` (Tabs fallback) |
| 3 | Section-cards captions + bars regression | PR 3 | `pnpm test src/components/DashboardView.test.tsx` | `pnpm dev` — Panel KPIs show Spanish captions, bars unchanged | Single-file revert `DashboardView.tsx` |

## Phase 1: Primitive Provisioning

- [x] 1.1 Run `pnpm dlx shadcn@latest add sidebar` non-interactively; fix `next/` imports if leaked in `src/components/ui/sidebar.tsx`
- [x] 1.2 Gate: `pnpm test` green and `pnpm build` (`tsc --noEmit`) green before shell work

## Phase 2: App Shell + TabId Nav (TDD)

- [x] 2.1 RED: extend `src/App.test.tsx` — menu navigates 3 views, exactly one `aria-current`, no `TabsTrigger` in DOM
- [x] 2.2 GREEN: create `src/components/app-sidebar.tsx` (`AppSidebar({active, onNavigate})`, lucide icons, Spanish labels)
- [x] 2.3 GREEN: rewrite `src/App.tsx` — `SidebarProvider` + `AppSidebar` + `SidebarInset`, reuse `TabId`, content `max-w-5xl`
- [x] 2.4 RED→GREEN: collapse-to-icons toggle and mobile overlay-dismiss tests in `src/App.test.tsx`

## Phase 3: Section-Cards Captions (TDD)

- [x] 3.1 RED: extend `src/components/DashboardView.test.tsx` — each KPI card shows value + exactly one Spanish caption; empty-store case
- [x] 3.2 GREEN: add pure `captionFor()` helpers + `CardDescription` captions in `src/components/DashboardView.tsx`; selectors only, no store change
- [x] 3.3 Verify selector-only rule: values trace to `pacientes`, `countByDiagnosis`, `averageHb`; chart JSX untouched

## Phase 4: Regression and Verification

- [x] 4.1 Bars byte-identical check: `hb-chart`/`age-chart` (320×200, no ResponsiveContainer) assertions unchanged in `DashboardView.test.tsx`
- [x] 4.2 Full gate: `pnpm test` + `pnpm build` green; confirm no data-table/palette/auth code added
