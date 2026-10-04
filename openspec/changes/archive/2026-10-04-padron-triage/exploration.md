## Exploration: padron-triage (severity-priority queue + duplicate warning)

### Current State
- `src/stores/padronStore.ts` holds `pacientes` with derived selectors `countByDiagnosis()` and `averageHb()` only; no severity ordering exists. `add` trims `nombre`, validates Spanish messages, enforces `MAX_PADRON = 100`, and derives `diagnostico` via pure `evaluatePatient` (`src/domain/anemia.ts`: Normal >= 11.0, Leve 10.0-10.9, Moderada 7.0-9.9, Severa < 7.0). No schema gap: triage needs only existing `diagnostico` + `nombre` columns.
- `src/components/PadronView.tsx` renders insertion-order rows with a single `filter` state normalized by `trim().toLowerCase()` only (lines 51-55) — no diacritics folding, no severity sort, no toggle. Row badges reuse the shared `DIAGNOSIS_BADGE` map imported from `DashboardView` (line 14), so badge wiring is proven.
- `src/components/RegisterForm.tsx` validates inline (empty nombre, edad 6-59, hb > 0) then calls `store.add`; no duplicate check. Success path reads `getState().pacientes.at(-1)` for the confirmation line.
- `src/components/DashboardView.tsx` already computes `moderateSevere = Moderada + Severa` (line 55) for the "Moderada + Severa" KPI card — the alert-card reuse point is real.
- Tests (`PadronView.test.tsx`, `RegisterForm.test.tsx`, 7 files / 32 green per config) cover filter case-insensitivity, badges, edit/delete, and Spanish validation — but nothing covers ordering or duplicates.

### Affected Areas
- `src/stores/padronStore.ts` — candidate home for a pure `SEVERITY_RANK` map + `bySeverity()`/`findPossibleDuplicates(nombre)` selectors (or keep pure helpers in `lib/`).
- `src/components/PadronView.tsx` — toggle ("ver graves primero"), sorted `visible` list, alert line reusing `moderateSevere` count, "Posible duplicado" badge in `PadronRow`.
- `src/components/RegisterForm.tsx` — non-blocking duplicate hint on submit/blur ("Ya existe un paciente con ese nombre").
- `src/lib/normalize.ts` (new, ~10 lines) — shared `normalizeNombre` with `NFD` + diacritic strip; also fixes the existing filter's accent gap ("José" vs "jose").
- `openspec/specs/padron-table/spec.md` — delta spec target (ordering + duplicate requirements).

### Approaches
1. **Store selectors + warning-only duplicates (recommended)** — Add pure `SEVERITY_RANK` (Severa 0, Moderada 1, Leve 2, Normal 3) and selectors in the store (or pure `lib/` helpers consumed by a thin selector); `PadronView` gains a `gravesPrimero` boolean state defaulting to off, sorting a copy of the filtered list with a stable tiebreak (insertion index). Duplicate detection is a `normalizeNombre` exact-match helper (`trim → toLowerCase → NFD → strip \p{Diacritic} → collapse whitespace`); `RegisterForm` shows a warning but still calls `add`, and `PadronRow` shows an outline `Badge` "Posible duplicado" when a same-normalized-name sibling exists.
   - Pros: single source of truth, mock-free unit tests on pure selectors; never blocks field registration (offline campaign constraint); fixes accent matching in filter + duplicates at once; badge reuse via existing `DIAGNOSIS_BADGE`/`Badge` pattern; ~100-170 lines as budgeted.
   - Cons: slightly more store surface (two small selectors); toggle default-off must be a deliberate UX choice.
   - Effort: Low

2. **Component-local memo + blocking duplicate (not recommended)** — `useMemo` sort inside `PadronView` and `add` throwing on duplicate (or form refusing submit).
   - Pros: zero store changes.
   - Cons: sort logic untestable without rendering, duplicated if dashboard/alert reuse grows; blocking risks losing field data when two children share a name (common in campaigns) and conflicts with the store's current throw-only-for-validation/MAX contract; accent handling would still need the shared helper anyway.
   - Effort: Low (but higher operational risk)

### Recommendation
Adopt Approach 1: store (or `lib/`-pure + thin selector) `SEVERITY_RANK` ordering with an opt-in "Ver graves primero" toggle defaulting to insertion order, plus warning-only duplicate detection built on a shared diacritics-folding `normalizeNombre`. Confirm two details at proposal time: (a) toggle default off (preserves current behavior, avoids surprising community workers) and (b) duplicate scope = exact normalized-name match only (no fuzzy/edad matching — out of scope, avoids false positives).

### Risks
- Accent folding changes filter behavior ("Jose" now matches "José") — strictly an improvement, but snapshot it in a test so the change is intentional.
- Same-name siblings (siblings/cousins) will legitimately trigger "Posible duplicado" — warning-only mitigates; copy must say "posible", never "duplicado".
- Sort stability: `Array.sort` must operate on a copy with index tiebreak to avoid mutating store state and to keep same-severity rows in registration order.

### Ready for Proposal
Yes — scope is confirmed under the 800-line review budget (~100-170 lines), no schema change, no new deps, Spanish UI / English code. Orchestrator should tell the user: B1+B3 confirmed as `padron-triage`; next is `sdd-propose` with toggle-default-off and warning-only-duplicate decisions recorded.
