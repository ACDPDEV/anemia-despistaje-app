# Design: anemia-dashboard

## Technical Approach

Migrate shell to shadcn `Tabs`, rebuild `StatisticsView` as KPI `Card` row + Recharts `Chart` bars (Hb 4-band, age 6–23 vs 24–59), rebuild `PadronView` as `Table` + single `Input` filter + `Badge` labels. All data derives from existing Zustand selectors (`pacientes`, `countByDiagnosis`, `averageHb`) plus one pure presentation helper for age bands. Satisfies `dashboard` and `padron-table` specs; no new domain rules, offline-first stays.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| `shadcn init` Tailwind v4 CSS-first + `@/*` alias | Rewrites 1-line `index.css`; minimal alias diff in `tsconfig`/`vite.config` | **Adopt**: reviewable diff, semantic tokens replace `bg-blue-600`/`text-gray-*` |
| Charts via shadcn `Chart` wrapping Recharts | ~100KB gz bundle, needs fixed-size test strategy | **Adopt** per shadcn skill guidance; tooltips/a11y included; custom SVG rejected (reinvents Chart) |
| Hand single-filter `Table`, no TanStack | No sorting/pagination | **Adopt**: fits ≤100 rows and 800-line budget; TanStack rejected (+300 lines) |
| Age helper in `src/lib/ageGroups.ts`, NOT `domain/anemia.ts` | Keeps domain pure (Hb thresholds only) | **Adopt**: presentation grouping is testable, importable by DashboardView |
| Fixed-size `BarChart` (`width`/`height` props, no `ResponsiveContainer`) in tests | Browser stays responsive via CSS wrapper; tests assert without mocks | **Adopt**: kills jsdom `ResizeObserver` flake |

Component inventory: `button, card, table, input, badge, tabs, chart` only. Composition rules enforced: full `CardHeader/Title/Description/Content`; `TabsTrigger` inside `TabsList`; `Badge` for diagnosis (no raw spans); `cn()` for conditionals; `flex gap-*` (no `space-*`); semantic tokens only.

## Data Flow

```
usePadronStore (pacientes, countByDiagnosis, averageHb)
  ├── DashboardView ──→ KPI Cards (total, avg, 4 counts)
  │       ├── groupByAgeBand(pacientes) ──→ age risk bars
  │       └── toHbBandData(counts) ──→ Chart bars
  └── PadronTable ──→ useState(filter) ──→ filtered rows ──→ Table + Badge + edit/delete
```

Selectors stay the single source; views hold no patient copies. Filter is local `useState` (normalized `includes` on `nombre`/id). Edit/delete call existing `update`/`remove`.

## File Changes

| File | Action | Description |
|---|---|---|
| `components.json`, `src/components/ui/*`, `src/lib/utils.ts` | Create (generated, budget-excluded) | shadcn init output + `cn()` |
| `src/index.css` | Modify | Token rewrite via init |
| `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `package.json` | Modify | `@/*` alias + `recharts`, `clsx`, `tailwind-merge`, `cva`, Radix deps |
| `src/App.tsx` | Modify | Hand tabs → shadcn `Tabs` |
| `src/components/DashboardView.tsx` (+ test) | Create | KPI cards + 2 charts; replaces `StatisticsView` |
| `src/lib/ageGroups.ts` (+ test) | Create | `groupByAgeBand`, boundary 24→older group |
| `src/components/PadronView.tsx` (+ test) | Modify | `<ul>` → `Table` + `Input` + `Badge`, keep row edit/delete |
| `src/components/StatisticsView.tsx` | Delete | Superseded by `DashboardView` |

## Interfaces / Contracts

```ts
// src/lib/ageGroups.ts — presentation only
export type AgeBand = "6-23" | "24-59";
export function groupByAgeBand(ps: Pick<Paciente,"edadMeses">[]): Record<AgeBand, number>;
// rule: edadMeses < 24 → "6-23", else "24-59"

// Chart shapes (derived, no store change)
type HbBandDatum = { band: Diagnosis; count: number };   // 4 rows, BANDS order
type AgeBandDatum = { band: AgeBand; count: number };    // 2 rows
const DIAGNOSIS_BADGE: Record<Diagnosis, "default"|"secondary"|"destructive"|"outline"> =
  { Normal:"secondary", "Anemia Leve":"outline", "Anemia Moderada":"default", "Anemia Severa":"destructive" };
```

Empty states: avg shows `—` + "Sin registros"; table filter no-match shows "Sin resultados"; zero patients shows CTA instead of rows. Spanish labels, English identifiers.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (TDD first) | `groupByAgeBand` boundaries (23/24/59), `toHbBandData` mapping, badge map | Vitest pure-function tests |
| Component | KPI values from seeded store; 4 Hb bars + 2 age bars assertable; filter narrows/no-match; badges per row; edit/delete round-trip | Testing Library + fixed-size charts, seed via `add`/`reset` |
| Regression | `tsc --noEmit` + 32 existing tests green | Gate every slice commit |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

Stacked slice on `slice-3-sync` tip toward `main`. Rollback: `git checkout -- src/index.css`; delete `ui/*` + `components.json`; uninstall added deps; revert alias diff; gate `tsc --noEmit` + `vitest run`. No data migration; persist key unchanged.

## Open Questions

- [ ] Icon library default from `init` (lucide-react expected) — accept default?
- [ ] Preset/style default (nova?) — accept CLI default or pin project preset?
- [ ] Keep route `estadisticas` label or rename tab to "Panel"? (spec-neutral)
