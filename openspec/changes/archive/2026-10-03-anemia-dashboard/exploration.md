## Exploration: anemia-dashboard (shadcn migration + dashboard)

### Current State

React 19 + Vite 7 + Tailwind v4 (CSS-first via `@tailwindcss/vite`) + Zustand 5
persist store + deferred-safe Supabase sync. UI is a hand-rolled tab shell
(`App.tsx`: Registro / Padrón / Estadísticas) with raw `<button>`/`<input>`
elements using ad-hoc colors (`bg-blue-600`, `text-gray-700`). `index.css` is a
single line (`@import "tailwindcss"`); there is no `components.json`, no `cn()`
util, no chart library, and no Radix/clsx/tailwind-merge/lucide in
`node_modules` (verified). Reporting today is text-only: `StatisticsView`
reads `pacientes`, `countByDiagnosis()`, `averageHb()` selectors and prints
counts + average. `PadronView` is a `<ul>` of editable rows, no filtering.
All slices live on `slice-3-sync` (cumulative tip over slice-1/slice-2, ~1299
insertions vs `main`); `main` lacks the entire app. `strict_tdd` is on
(Vitest 3.2 + jsdom + Testing Library, 7 files / 32 tests green).

### Affected Areas

- `src/index.css` — shadcn init rewrites it with `@theme` tokens + semantic
  CSS vars. Risk is LOW (file is 1 line, nothing custom to lose), rollback is
  `git checkout -- src/index.css`.
- `components.json` (new) + `src/components/ui/*` (new) — generated shadcn
  sources (button, card, table, input, badge, tabs, chart). Rollback is delete
  files + uninstall added deps.
- `tsconfig.json` + `vite.config.ts` — init needs an `@/*` path alias
  (neither file defines one today); small, reviewable diff.
- `package.json` — new runtime deps (clsx, tailwind-merge, class-variance-authority,
  lucide-react or project icon lib, recharts, @radix-ui pieces per component).
- `src/App.tsx` — custom tab buttons migrate to shadcn `Tabs`
  (`TabsList` + `TabsTrigger`, triggers never bare).
- `src/components/StatisticsView.tsx` — becomes the dashboard host (KPI cards
  row, Hb distribution chart, risk-by-age 6–23 vs 24–59).
- `src/components/PadronView.tsx` — `<ul>` becomes filterable shadcn `Table`
  (`Input` filter + `Badge` diagnosis labels); row edit/delete preserved.
- `src/components/RegisterForm.tsx`, `src/domain/anemia.ts`,
  `src/stores/padronStore.ts`, `src/lib/sync.ts` — READ-ONLY sources.
  No new domain logic: KPI/chart/table data derives from existing selectors
  plus one pure presentation grouping (age bands) placed in a testable
  selector/helper, not in domain rules.
- Supabase — read-only live counts are a LATER step (`fetchAll` through the
  existing `createSupabaseSyncTable` seam); this change stays offline-first on
  the Zustand store.

### Approaches

1. **Recommended: shadcn init + shadcn Chart (Recharts) + hand-rolled
   filterable Table** — `npx shadcn@latest init` (Tailwind v4 CSS-first),
   `add button card table input badge tabs chart`; dashboard composes
   `Card` (full `CardHeader/Title/Description/Content` composition) + `Chart`
   bar chart for the 4 Hb bands + a second small bar/grouping for risk-by-age
   + `Table` with a single `Input` text filter and `Badge` diagnosis cells.
   - Pros: follows the official shadcn skill verbatim (semantic tokens,
     `cn()`, composition rules); Recharts is SVG-based, works in Vite/Tauri
     without canvas; `Chart` supplies tooltip/legend/a11y; hand table avoids a
     data-table dependency; fits the 800-line budget (~500–650 hand-written
     lines incl. tests; generated `ui/*` excluded from budget).
   - Cons: Recharts bundle weight (~100KB+ gz); needs a `ResizeObserver` /
     fixed-size strategy in jsdom tests.
   - Effort: Medium.

2. **Zero-dependency charts: shadcn init + custom SVG bars + hand table** —
   same shadcn shell, but the 4-band distribution and 2-group age chart are
   hand-drawn SVG `<rect>` bars (percentages are trivially computable).
   - Pros: no chart dependency at all; smallest bundle; trivially testable
     (assert widths/labels, no ResizeObserver mocks); still inside budget.
   - Cons: reinvents what shadcn `Chart` already wraps (tooltips, legends,
     accessibility, responsive behavior); diverges from the shadcn skill's
     "Charts → `Chart` (wraps Recharts)" guidance; future chart needs redo
     the work.
   - Effort: Low-Medium.

3. **Full data-table: shadcn init + Chart + TanStack Table + pagination/sorting** —
   adds `@tanstack/react-table`, column sorting, pagination, multi-filters.
   - Pros: most capable padrón table; closest to a "production admin" feel.
   - Cons: blows the 800-line review budget (adapter + column defs + tests
     ≈ +300–400 lines); overkill for ≤100 local rows; more Radix surface to
     review; higher drift risk against the unmerged slice stack.
   - Effort: High.

### Recommendation

Approach 1. It is the only option that satisfies all constraints at once:
official shadcn skill compliance (`Chart` for charts, `Table`/`Card`/`Badge`
composition, semantic tokens, `cn()`), Recharts' Vite/Tauri-friendly SVG
rendering, zero new domain logic (all views read existing Zustand selectors),
and a hand-rolled single-filter table that keeps hand-written code inside the
800-line review budget. TDD plan: unit-test the pure age-band grouping helper
and KPI derivations first, then component tests with fixed chart dimensions
(mock `ResizeObserver` once in `src/test/setup.ts` or assert on the
transformed chart data + rendered labels). Branch from `slice-3-sync` (the
cumulative tip — `main` does not contain the app) as the next stacked slice
toward `main`; rebase onto `slice-3-sync` tip before starting to avoid drift.

### Risks

- `index.css` rewrite during `init` — mitigated: file is 1 line, diff is
  reviewable, rollback is one `git checkout`; verify no visual regression in
  existing views after token swap (raw `bg-blue-600`/`text-gray-*` classes
  get replaced by semantic tokens during migration).
- Alias wiring (`@/*` in tsconfig + vite resolve) — init may edit both;
  keep the diff minimal and confirm `tsc --noEmit` + `vitest run` pass.
- Recharts in jsdom — `ResponsiveContainer` needs width mocking; use fixed
  sizes in tests and reserve responsiveness for the browser.
- Slice-stack drift — 3 unmerged slices; branching the dashboard off anything
  but `slice-3-sync` tip silently drops ~1299 lines. Rebase first, merge
  stacked-to-main per delivery strategy.
- Scope creep (live Supabase counts, pagination, sorting) — explicitly out;
  defer to follow-up changes or the budget breaks.

### Ready for Proposal

Yes. Orchestrator should confirm: (a) Approach 1 (shadcn init + shadcn
Chart/Recharts + hand-rolled filterable table); (b) base branch
`slice-3-sync` with stacked-to-main delivery; (c) generated `ui/*` files
excluded from the 800-line review budget; (d) Supabase live counts deferred.
No user clarification needed — open questions (icon library, preset) can be
resolved at `init` time with defaults.
