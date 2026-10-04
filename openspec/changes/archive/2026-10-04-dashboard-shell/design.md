# Design: dashboard-shell

## Technical Approach

Replace `App.tsx` top `Tabs` with a persistent shadcn sidebar shell, and upgrade `DashboardView` KPI cards to the section-cards pattern. Provision `ui/sidebar.tsx` via `pnpm dlx shadcn@latest add sidebar` (Base UI primitive + separator/skeleton/sheet/tooltip deps), hand-build `app-sidebar.tsx` mapping existing `TabId` state to `SidebarMenuButton isActive`, widen content to `max-w-5xl`. Card values stay on existing selectors (`pacientes`, `countByDiagnosis`, `averageHb`); captions are pure presentation helpers. Recharts bars byte-identical. Covers `app-shell` + `kpi-cards` specs and `dashboard` delta.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| CLI `add sidebar` vs hand-rolled vs block import | CLI gives tested Base UI primitive + deps; hand-roll risks a11y bugs; block risks Next-path leakage | CLI provision `ui/sidebar.tsx` only, never import block verbatim |
| Reuse `TabId` vs router vs new nav state | Router adds dep + migration; new state duplicates truth; `TabId` is single source already tested | Reuse `TabId` (`register \| padron \| dashboard`); sidebar is sole nav, top `Tabs` removed |
| Inline caption helpers vs store selectors vs new domain rules | New rules violate `kpi-cards` selector-only requirement; store change is oversized | Pure helpers over existing selector outputs; no store/domain change |
| `max-w-5xl` vs full-width vs keep `max-w-2xl` | Full-width hurts field readability; `2xl` cramps cards + sidebar | `SidebarInset` content `mx-auto max-w-5xl`; sidebar tokens already in `index.css`, no CSS change expected |
| `SidebarProvider` collapse vs custom toggle | Custom toggle duplicates overlay/focus logic; provider gives icon-mode + mobile off-canvas | Minimal provider use: `collapsible="icon"`, `SidebarTrigger`, sheet overlay on small screens |

## Data Flow

    TabId state (App) ──→ AppSidebar (isActive) ──→ view render
          │                       │
          └─→ SidebarInset content (max-w-5xl) ──→ DashboardView
                                                        │
              padronStore selectors ──→ KPI values ──→ cards + captions
              groupByAgeBand / toHbBandData ──→ bars (untouched)

Nav is local `useState`; data stays in Zustand selectors. No fetching, no routing.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/ui/sidebar.tsx` | Create | CLI-provisioned primitive (+separator/skeleton/sheet/tooltip); fix `next/` imports if leaked |
| `src/components/app-sidebar.tsx` | Create | `AppSidebar({ active, onNavigate })` with lucide icons, Spanish labels, `SidebarMenuButton isActive` |
| `src/App.tsx` | Modify | `SidebarProvider` + `AppSidebar` + `SidebarInset`; remove `Tabs`; keep `TabId`, widen to `max-w-5xl` |
| `src/components/DashboardView.tsx` | Modify | Section-cards: `CardDescription` trend captions per KPI; chart JSX untouched |
| `src/index.css` | Modify iff missing | Sidebar tokens already present; append only if CLI diff requires |
| `src/App.test.tsx`, `src/components/DashboardView.test.tsx` | Modify | Strict TDD: nav-by-menu, collapse, caption, bars-regression tests |

## Interfaces / Contracts

```tsx
type TabId = "register" | "padron" | "dashboard"; // unchanged, moved import if needed
type NavItem = { id: TabId; label: string; icon: LucideIcon };
function AppSidebar(props: { active: TabId; onNavigate: (id: TabId) => void }): JSX.Element;
function captionFor(metric: "total" | "avg" | "anemia" | "modsev", empty: boolean): string; // Spanish, pure
```

Composition rules: `TabsTrigger`-free nav; full `CardHeader/Title/Description/Content`; `Badge` for diagnosis bands; `gap-*` layout, semantic tokens, `cn()`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Integration | Sidebar switches all 3 views, exactly one active, no `Tabs` remains | Testing Library: click menu entries, assert view + `aria-current` |
| Integration | Collapse to icons, expand restores labels; small-screen overlay dismisses on select | Toggle `SidebarTrigger`; jsdom + viewport mock |
| Integration | Every KPI card shows value + exactly one Spanish caption; empty state captions | Seed padron (5-patient fixture), assert `kpi-*` + captions; empty store case |
| Regression | Bars byte-identical (320×200, no ResponsiveContainer) | Existing `hb-chart`/`age-chart` assertions unchanged; fail on SVG diff |
| Gate | `pnpm test` + `pnpm build` (`tsc --noEmit`) green | Per `openspec/config.yaml` verify commands |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. In-app `TabId` switching only.

## Migration / Rollout

No migration required. No flags: single atomic shell swap (dual nav forbidden). Rollback: delete `ui/sidebar.tsx` (+ auto-added dep files) and `app-sidebar.tsx`, restore `App.tsx` Tabs version from VCS; cards revert is `DashboardView.tsx` single-file revert. Chained slices (primitive → shell → cards) keep each revert under review budget.

## Open Questions

- None blocking. Minor: collapse default on tablet widths — accept provider default, revisit after field feedback.
