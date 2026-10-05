# Anemia Despistaje App

Childhood anemia screening registry (ages 6–59 months) that works fully offline in the field and syncs to Supabase when staff choose to.

Health workers capture a local padron during screening jornadas, the app classifies anemia severity from hemoglobin on the spot, and a manual **Sincronizar** button (Alt+G) pushes local changes then pulls remote updates. No network in the field? Everything keeps working — the local padron on the device is the source of truth.

## Quick path

1. Install: `pnpm install`
2. Run: `pnpm dev` → open the Vite URL (UI is 100% Spanish, dark + light themes)
3. Verify: `pnpm test`

```bash
pnpm install
pnpm dev      # web development
pnpm test     # 436 tests, all green
pnpm build    # typecheck + production build into ./dist
```

> Without Supabase credentials the app runs fully local. Sync and sign-in appear only when `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are present at build time.

## Docs

| Guide | Answers |
|-------|---------|
| [docs/architecture.md](docs/architecture.md) | Layers, stores, domain evaluator, Paciente data model |
| [docs/sync-and-auth.md](docs/sync-and-auth.md) | Manual sync flow, merge rules, auth gate, RLS |
| [docs/desktop-releases.md](docs/desktop-releases.md) | Tauri builds, CI release workflow, install notes |
| [docs/development.md](docs/development.md) | Setup, scripts, testing, web deploy, conventions |

## Scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | `tsc --noEmit && vite build` → `./dist` |
| `pnpm preview` | Serve the production build locally |
| `pnpm test` | Run the Vitest suite once (`vitest run`) |
| `pnpm tauri` | Tauri CLI (desktop shell; dev server on port 1420) |

## Tech

| Layer | Choice |
|-------|--------|
| App | Vite 7 + React 19 + TypeScript |
| Desktop | Tauri v2 |
| Styling | Tailwind CSS v4, shadcn/Base UI (`@base-ui/react`), Lucide icons |
| Local state | Zustand + localStorage (offline-first padron) |
| Backend | Supabase (`@supabase/supabase-js`, email/password auth, Postgres + RLS) |
| Charts | Recharts |
| Tests | Vitest + Testing Library + jsdom |
| Package manager | pnpm |

## Clinical rules (enforced, not just displayed)

| Rule | Value | Where |
|------|-------|-------|
| Age range | Integer, 6–59 months | `src/stores/padronStore.ts` |
| Hemoglobin | Finite number > 0 g/dL | `src/stores/padronStore.ts` |
| Nombre | Required, max 120 chars | `src/stores/padronStore.ts` |
| Local cap | 100 patients (`MAX_PADRON`) | `src/stores/padronStore.ts` |
| Normal | Hb ≥ 11.0 g/dL | `src/domain/anemia.ts` (`evaluatePatient`) |
| Anemia Leve | Hb 10.0–10.9 g/dL | `src/domain/anemia.ts` |
| Anemia Moderada | Hb 7.0–9.9 g/dL | `src/domain/anemia.ts` |
| Anemia Severa | Hb < 7.0 g/dL | `src/domain/anemia.ts` |

Spanish decimal input (`"11,5"`) is parsed via `parseHemoglobina` in `src/domain/anemia.ts`. Hb fields are `type="text"` with `inputMode="decimal"` on purpose: `<input type="number">` strips the comma before `onChange` ever fires.

## Sync in one paragraph

Manual only — push dirty records, then pull and merge last-write-wins on `updated_at`. `diagnostico` is always recomputed client-side, never trusted from the server. Deletes replicate as tombstones (`deleted_at`). Details: [docs/sync-and-auth.md](docs/sync-and-auth.md).
