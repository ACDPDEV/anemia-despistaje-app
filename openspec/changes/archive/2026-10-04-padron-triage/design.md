# Design: Padron Triage (severity queue + duplicate warning)

## Technical Approach

Opt-in severity ordering + warning-only duplicates on existing store data. Pure helper (`normalizeNombre` in `src/lib/normalize.ts`, `SEVERITY_RANK` + store selectors `bySeverity` / `findPossibleDuplicates`) with thin composition; `PadronView` composes filter → severity sort on a copied array; `RegisterForm` adds a non-blocking dismissible hint after validation passes. Covers specs `triage-sort`, `duplicate-warning`, and `padron-table` delta (accent-folding filter).

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| `src/lib/normalize.ts` vs inline in store | Inline avoids a file but splits accent logic between filter and duplicates | **New `src/lib/normalize.ts`** following `ageGroups.ts` pure-helper pattern; store + views import it |
| Toggle in zustand vs local `useState` | Store persists across tabs but leaks view session state into persisted `padron-storage` | **Local `useState gravesPrimero=false` in `PadronView`**; session-only per spec, no persist change |
| Duplicate check inside `add()` vs form/view layer | Store throw blocks field registration, conflicts with throw-only-validation contract | **`findPossibleDuplicates()` selector + form hint + row badge; `add()` untouched**, warning-only |
| Alert line source | Recomputing counts in view duplicates `DashboardView` logic | **Inline `Moderada + Severa` count in `PadronView` reusing `DashboardView` `moderateSevere` pattern**, no new selector |

## Data Flow

```
pacientes (store) ──→ filter(normalizeNombre) ──→ copy+sort(SEVERITY_RANK, index tiebreak) ──→ visible rows
       │──→ findPossibleDuplicates(nombre) ──→ RegisterForm hint (validate → warn → add) / PadronRow badge
        └──→ inline Moderada + Severa count ──→ "Moderada + Severa: N" alert line
```

Toggle off = `visible` is the filtered array as-is; toggle on = `[...filtered].sort()` by rank. Sort never mutates store state.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/lib/normalize.ts` | Create | `normalizeNombre`; pure, ~10 lines (trim → lowercase → NFD strip → collapse spaces) |
| `src/stores/padronStore.ts` | Modify | Export `SEVERITY_RANK`, store selectors `bySeverity(list)`, `findPossibleDuplicates(nombre)` |
| `src/components/PadronView.tsx` | Modify | `gravesPrimero` toggle (default off), sorted `visible`, alert line, `PadronRow` badge `variant="outline"` |
| `src/components/RegisterForm.tsx` | Modify | Dismissible hint "Posible duplicado: ya existe…" with dismiss button clearing warning state on blur/submit after validation, before/around `add`; never blocks |
| `src/components/DashboardView.tsx` | Reuse | No change; `DIAGNOSIS_BADGE` + `moderateSevere` pattern reference only |

## Interfaces / Contracts

```ts
// src/lib/normalize.ts
export function normalizeNombre(nombre: string): string;
// "  María  López " → "maria lopez"; "José" → "jose"

// padronStore.ts additions
export const SEVERITY_RANK: Record<Diagnosis, number>; // Severa 0, Moderada 1, Leve 2, Normal 3
bySeverity(list: Paciente[]): Paciente[];              // sorted copy, stable by input index
findPossibleDuplicates(nombre: string): Paciente[];    // exact normalizeNombre match
```

Non-obvious rule: `bySeverity` must copy before `.sort()`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (Vitest) | `normalizeNombre` ("José"→"jose", collapse), `SEVERITY_RANK` order + stable tiebreak + copy-not-mutate, `findPossibleDuplicates` exact/negative | New `normalize.test.ts` + extend `padronStore.test.ts`, mock-free pure calls |
| Integration | Toggle on/off ordering; dismissible hint shows yet submit registers, dismiss button clears warning; badge on both dup rows; "Jose" finds "José" | Extend `PadronView.test.tsx`, `RegisterForm.test.tsx` with Testing Library |
| E2E | None | Out of scope; no harness exists |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. No schema/persist change; toggle defaults off so revert (`git revert`) restores insertion order. Feature is additive UI + pure selectors.

## Open Questions

- [ ] Badge copy final: "Posible duplicado" as outline `Badge` next to diagnosis — confirmed?
- [ ] RegisterForm hint trigger: live on blur + submit, or submit-only? Propose both (blur warns early, submit re-checks).
