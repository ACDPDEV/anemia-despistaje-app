# Anemia Despistaje App

Childhood anemia screening registry — Vite React TS + Tauri v2 + Tailwind + Zustand + Supabase (deferred-safe sync).

## Stack

- Vite 7 + React 19 + TypeScript
- Tauri v2 (desktop shell, dev server on port 1420)
- Tailwind CSS v4
- Zustand (local padron store with persistence)
- Supabase (gated sync, applied in slice 3)

## Scripts

- `pnpm dev` — start Vite dev server
- `pnpm build` — typecheck + production build
- `pnpm test` — run Vitest suite (32 tests)

## Review slices (stacked to main, merge in order)

1. `slice-1-scaffold-domain-store` — domain rules + padron store + tests
2. `slice-2-ui` — components + App wiring + tests
3. `slice-3-sync` — Supabase client + sync engine + gated migration + tests

Rollback per slice: revert the corresponding merge.
