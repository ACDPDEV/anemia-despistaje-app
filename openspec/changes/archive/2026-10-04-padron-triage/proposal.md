# Proposal: Padron Triage (severity queue + duplicate warning)

## Intent

Field workers register children in arrival order and cannot see the most severe cases first; duplicate names are re-registered silently. This change adds an opt-in severity queue and a warning-only duplicate signal without blocking field registration.

## Scope

### In Scope
- `bySeverity` store selector (`SEVERITY_RANK`: Severa 0, Moderada 1, Leve 2, Normal 3) sorting a copied array with insertion-index tiebreak
- "Ver graves primero" toggle in `PadronView` (default off), plus alert line reusing `Moderada + Severa` count
- Shared `normalizeNombre` helper (trim, lowercase, NFD diacritic strip, whitespace collapse) used by filter and duplicates
- Warning-only duplicate hint in `RegisterForm` and "Posible duplicado" badge in `PadronRow` (existing `Badge`/`DIAGNOSIS_BADGE` pattern)

### Out of Scope
- Schema or persistence changes; new dependencies
- Blocking duplicate registration or fuzzy/age-based matching (exact normalized-name only)
- Dashboard charts or edit/delete behavior changes

## Capabilities

### New Capabilities
- `triage-sort`: severity-priority ordering with opt-in toggle and stable tiebreak
- `duplicate-warning`: warning-only possible-duplicate signal on form and row badge

### Modified Capabilities
- `padron-table`: text filter folds diacritics via shared `normalizeNombre` (e.g. "Jose" matches "José")

## Approach

Pure selectors in store (or `lib/` pure helpers + thin selectors): `SEVERITY_RANK` map, `bySeverity()`, `findPossibleDuplicates(nombre)`. `PadronView` holds `gravesPrimero` boolean, sorts a copy of the filtered list. Duplicates never throw; copy always says "posible", never "duplicado".

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/stores/padronStore.ts` | Modified | `SEVERITY_RANK`, `bySeverity`, `findPossibleDuplicates` selectors |
| `src/lib/normalize.ts` | New | Shared `normalizeNombre` (~10 lines) |
| `src/components/PadronView.tsx` | Modified | Toggle, sorted `visible`, alert line, duplicate badge |
| `src/components/RegisterForm.tsx` | Modified | Non-blocking duplicate hint on submit/blur |
| `src/components/DashboardView.tsx` | Reused | Alert count line reuses `moderateSevere` (no logic change) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Same-name siblings trigger false "posible" flags | Med | Warning-only copy; never blocks `add` |
| Accent folding changes filter matches | Low | Intentional; snapshot test pins behavior |
| In-place sort mutates store state | Low | Sort a copy with index tiebreak; unit test |

## Rollback Plan

Revert the change branch (`git revert`); toggle defaults off so removal restores insertion order with no migration. No schema touched.

## Dependencies

- None. Prior TAR archive `2026-10-03-anemia-despistaje-app` is context only.

## Success Criteria

- [ ] Toggle on lists Severa before Moderada before Leve before Normal, ties in registration order
- [ ] Exact normalized-name duplicate shows hint + badge but still registers
- [ ] `pnpm test` and `pnpm build` (`tsc --noEmit`) pass
