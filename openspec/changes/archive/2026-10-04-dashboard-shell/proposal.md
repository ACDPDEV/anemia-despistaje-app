# Proposal: dashboard-shell

## Intent

Replace the cramped `max-w-2xl` top-Tabs layout with a persistent collapsible sidebar shell and section-cards KPIs, giving field staff readable navigation and scannable screening metrics without changing domain rules.

## Scope

### In Scope
- Sidebar shell: `SidebarProvider` + `AppSidebar` + `SidebarInset`, single nav source (Registro/Padrón/Panel), content `max-w-5xl`
- KPI cards upgraded to section-cards pattern (trend captions, Spanish copy)
- Hand-built shell/cards in project idiom; Recharts bars byte-identical
- Strict TDD updates to `App.test.tsx`, `DashboardView.test.tsx`

### Out of Scope
- Data-table, command palette, auth/permissions
- Responsive chart resizing (bars stay fixed-size)
- New domain rules or data fetching

## Capabilities

### New Capabilities
- `app-shell`: persistent sidebar navigation shell replacing top Tabs
- `kpi-cards`: section-cards KPI pattern with trend captions

### Modified Capabilities
- `dashboard`: KPI presentation changes (nav context + card captions); chart/grouping requirements unchanged

## Approach

Per exploration Option 1: `npx shadcn@latest add sidebar` (CLI-provisioned primitive + deps, Base UI-based), hand-build `AppSidebar` (Spanish labels, English identifiers); map existing `TabId` state to `SidebarMenuButton isActive`; replace (not dual) top Tabs; chain slices (primitive → shell → cards) to respect review budget.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/App.tsx` | Modified | Sidebar shell, remove Tabs, widen to `max-w-5xl` |
| `src/components/app-sidebar.tsx` | New | Sidebar nav with lucide icons, collapsible icon mode |
| `src/components/ui/sidebar.tsx` | New | CLI-provisioned primitive (+separator/skeleton/sheet/tooltip) |
| `src/components/DashboardView.tsx` | Modified | Section-cards captions; charts untouched |
| `src/index.css` | Modified | Sidebar tokens only if missing |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `sidebar.tsx` size blows review budget | High | Chained slices; primitive-only first slice |
| Base UI (not Radix) / Next-path leakage from block | Med | CLI add only, never verbatim block import; fix `next/` imports |
| Dual-nav state/a11y duplication | Low | Single nav source decision enforced in spec |

## Rollback Plan

Revert slice commits in reverse order (cards → shell → primitive); `App.tsx` Tabs version is the last-known-good fallback. No data migration involved.

## Dependencies

- Prior TAR archived change (2026-10-03) as reference context only
- `npx shadcn@latest add sidebar` CLI availability

## Success Criteria

- [ ] Sidebar navigates all three views, collapses, works mobile off-canvas
- [ ] KPI cards show trend captions in Spanish; `pnpm test` + `pnpm build` green
- [ ] No data-table/command-palette/auth code added; bars unchanged
