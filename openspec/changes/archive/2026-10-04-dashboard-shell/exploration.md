## Exploration: dashboard-shell

### Current State

- `src/App.tsx` is a `max-w-2xl` centered column: title + shadcn `Tabs` (`Registro` / `Padrón` / `Panel`) switching `RegisterForm`, `PadronView`, `DashboardView` via local `useState<TabId>`. No sidebar, no app chrome.
- `src/components/DashboardView.tsx` renders 4 plain KPI `Card`s (total, avg Hb, anemia %, moderada+severa), 4 diagnosis band cards with `Badge`, and 2 fixed-size Recharts `BarChart`s (320x200, `isAnimationActive={false}`). All data derives from existing Zustand selectors (`pacientes`, `countByDiagnosis`, `averageHb`) plus pure `groupByAgeBand` — no new data fetching needed.
- shadcn setup is ready: `components.json` exists (`base-nova`, Tailwind v4 CSS-first, `@/` aliases), `src/index.css` already defines `--sidebar-*` tokens (light + dark), `class-variance-authority`, `lucide-react`, `@base-ui/react`, and `cn` are installed. Installed UI: `badge, button, card, chart, input, table, tabs`. No `sidebar`, `separator`, `skeleton`, `sheet`, or `tooltip` yet — those come from `npx shadcn@latest add sidebar` via CLI.
- Prior verdict stands: selective hand-built adoption of the official `dashboard-01` block's **sidebar shell + section-cards** pattern only. No block import verbatim (Next.js paths), no data-table.

### Affected Areas

- `src/App.tsx` — shell rewrite: `SidebarProvider` + `AppSidebar` + `SidebarInset` with header/trigger; content widens to `max-w-5xl`; tab state drives sidebar menu active state.
- `src/components/app-sidebar.tsx` (new) — sidebar nav (Registro/Padrón/Panel) with lucide icons, collapsible (`icon` mode), field-readable labels.
- `src/components/ui/sidebar.tsx` + deps (new via CLI: `separator`, `skeleton`, `sheet`, `tooltip` as pulled by `add sidebar`) — sidebar primitive and mobile sheet behavior.
- `src/components/DashboardView.tsx` — KPI cards upgraded to section-cards pattern (`CardDescription` trend captions, `@tabler`-style footer hint replaced with lucide `TrendingUp/Down` + Spanish captions); Recharts bars untouched.
- `src/components/DashboardView.test.tsx`, `src/App.test.tsx` — strict TDD: sidebar navigation and section-card captions need coverage updates.

### Approaches

1. **Sidebar shell (recommended)** — Add `sidebar` (+ CLI-pulled deps) via `npx shadcn@latest add sidebar`; hand-build `AppSidebar` in project idiom (Spanish labels, English identifiers); `SidebarProvider` wraps app, `SidebarInset` holds `max-w-5xl` content with `SidebarTrigger` header; existing `TabId` state becomes the single navigation source (sidebar `SidebarMenuButton isActive` + `onClick` sets tab); keep `Tabs` removed from `App.tsx` (single nav source) or retained hidden for a11y — recommend **replace**, not dual nav. Mobile: default `Sheet`-based off-canvas from the primitive, no custom work; collapsible `icon` mode on desktop.
   - Pros: Matches goal (field-readable persistent nav, collapsible, mobile off-canvas free); sidebar tokens already in CSS; single navigation state, no sync bugs; section-cards pattern fits existing KPI data 1:1; ~200-300 lines as budgeted.
   - Cons: New primitive files (~sidebar.tsx is large, counts toward review budget — mitigates via chained PR: slice 1 = sidebar primitive, slice 2 = shell + section-cards); removes familiar top tabs (minor user relearning).
   - Effort: Medium

2. **Widened top-nav (no sidebar)** — Keep `Tabs`, widen to `max-w-5xl`, restyle KPI cards with trend captions only.
   - Pros: Smallest diff (no new deps, no primitive files); zero nav relearning; stays well under review budget in one PR.
   - Cons: Fails the stated goal (no persistent/collapsible field-readable nav, no app shell); top tabs crowd on small screens; does not establish the dashboard-01 shell for future slices (data-table etc. would re-litigate layout).
   - Effort: Low

### Recommendation

Option 1 (sidebar shell). Rationale: it is the only approach that meets the goal; all prerequisites are already in place (sidebar CSS tokens, Base UI, CVA, lucide, `cn`); CLI-provisioned primitive avoids hand-rolling a11y/keyboard/off-canvas behavior; existing `TabId` state maps directly to `SidebarMenuButton isActive`, so migration is a small wiring change; KPI data needs no transformation for section-cards (counts/avg/pct already computed — only captions added). Tabs→sidebar path: **replace** top `Tabs` with sidebar as the single nav source to avoid dual-nav sync bugs and duplicate a11y tab lists. Keep Recharts bars byte-identical.

Proposed slice plan (for sdd-tasks, review budget 800 lines, auto-chain): slice 1 = `add sidebar` primitive + deps only; slice 2 = `AppSidebar` + `App.tsx` shell + `max-w-5xl`; slice 3 = section-cards captions + tests. Strict TDD throughout (`pnpm test`, `pnpm build` gate).

### Risks

- `sidebar.tsx` primitive size inflates slice-1 diff — mitigate with dedicated chained PR slice (generated-style primitive, reviewer skims).
- `base-nova` uses Base UI primitives, not Radix — verify CLI output compiles under Vite (no Next paths); hand-fix any `next/` imports if a block file leaks in (policy: do not import block files verbatim).
- Dual-nav temptation (keeping Tabs + sidebar) creates state/a11y duplication — decision: single nav source (sidebar).
- Fixed 320px charts in wider `max-w-5xl` content may look narrow — out of scope (bars stay as-is per constraints); revisit responsive chart sizing in a later change.

### Ready for Proposal

Yes — scope is bounded, prerequisites verified, no user clarification needed. Orchestrator may proceed to `sdd-propose` for `dashboard-shell`.
