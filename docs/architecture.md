# Architecture: local first, server second

The local padron (Zustand + localStorage) is the source of truth. Supabase is a deferred replica that only changes on an explicit manual sync.

## Quick path

1. User registers a patient → `RegisterForm` validates via `padronStore` → stored locally, marked `dirty`.
2. Staff review in `PadronView`, analyze in `DashboardView`.
3. Staff press **Sincronizar** → push dirty rows, pull remote rows, merge, recompute diagnoses.

## Layers

```mermaid
flowchart TB
    subgraph UI["React views (src/components)"]
        RF["RegisterForm"]
        PV["PadronView"]
        DV["DashboardView"]
        LV["LoginView"]
        CHIP["SyncStatusChip"]
    end
    subgraph ST["Stores (src/stores)"]
        PS["padronStore<br/>(Zustand + persist)"]
        RD["registerDraftStore"]
    end
    subgraph DOM["Domain + lib (pure)"]
        AN["domain/anemia.ts<br/>evaluatePatient, parseHemoglobina"]
        SY["lib/sync.ts<br/>pushDirty, pullRemote, mergePacientes"]
        SG["lib/syncGuard.ts<br/>guardedPull, cooldown, in-flight guard"]
        AU["lib/auth.ts"]
        SB["lib/supabase.ts<br/>lazy client"]
    end
    SUP["Supabase Postgres<br/>(public.pacientes + RLS)"]

    RF --> PS
    PV --> PS
    DV --> PS
    CHIP --> SG
    SG --> SY
    PS --> AN
    SY --> AN
    LV --> AU
    AU --> SB
    SY --> SB
    SB --> SUP
```

| Layer | Responsibility | Never does |
|-------|---------------|------------|
| Components | Render Spanish UI, collect input, show sync status | No clinical math, no direct Supabase calls |
| Stores | Own the padron, validate invariants, persist to localStorage | No network |
| Domain (`domain/anemia.ts`) | Pure evaluator + Hb parser, zero I/O | No state, no side effects |
| Lib (`lib/sync.ts`, `syncGuard.ts`) | Push/pull/merge, cooldown + in-flight guard | No auto-sync, no UI |
| Supabase client (`lib/supabase.ts`) | Lazy client, `null` when unconfigured | Never throws when credentials are missing |

## Paciente record

```mermaid
flowchart LR
    P["Paciente"] --- ID["id: string (uuid)"]
    P --- NO["nombre: string (1-120 chars)"]
    P --- ED["edadMeses: int 6-59"]
    P --- HB["nivelHemoglobina: number > 0"]
    P --- DG["diagnostico: derived<br/>(recomputed, never stored as truth)"]
    P --- UA["updatedAt: ISO string<br/>(merge key, LWW)"]
    P --- DI["dirty: boolean<br/>(needs push)"]
    P --- DL["deletedAt: ISO string or null<br/>(tombstone)"]
```

Remote rows mirror this in snake_case (`edad_meses`, `nivel_hemoglobina`, `updated_at`, `deleted_at`) plus `user_id` for RLS ownership — see `toRemoteRow` / `fromRemoteRow` in `src/lib/sync.ts`.

## Key files

| Path | Role |
|------|------|
| `src/App.tsx` | Auth gate + tab routing (Registro / Padrón / Panel) |
| `src/domain/anemia.ts` | `evaluatePatient`, `HB_CUTOFF_LABEL`, `parseHemoglobina` |
| `src/stores/padronStore.ts` | Padron state, validation, `MAX_PADRON = 100` |
| `src/lib/sync.ts` | `pushDirty`, `pullRemote`, `mergePacientes`, `SYNC_PAGE_SIZE = 1000` |
| `src/lib/syncGuard.ts` | In-flight guard, 20 s pull cooldown, shared status vocabulary |
| `src/lib/supabase.ts` | Lazy client, `isSupabaseConfigured` |
| `src/lib/auth.ts` | Email/password seam over `supabase-js` auth |
| `src/hooks/useOnline.ts` | Connectivity signal for sync surfaces |

## Checklist

- [ ] New clinical logic goes in `src/domain/` as a pure function with tests.
- [ ] New server state goes through `lib/sync.ts` — never call Supabase from a component.
- [ ] UI copy stays Spanish; code, comments, and identifiers stay English.

## Next step

Sync and sign-in details: [sync-and-auth.md](sync-and-auth.md).
