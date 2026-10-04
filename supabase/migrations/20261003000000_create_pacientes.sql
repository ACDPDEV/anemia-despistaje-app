-- GATED MIGRATION — DO NOT APPLY YET.
-- Blocked on: Supabase project URL + anon key (unknown), `supabase db advisors`
-- review before apply, and per-user auth decision wiring (LoginView + RLS smoke
-- test against a scratch project with real credentials).
-- Rollback: 20261003000000_create_pacientes.down.sql (DROP TABLE + policies).
-- Local app is unaffected: the offline-first padron (Zustand + localStorage)
-- is the source of truth; `diagnostico` is always recomputed client-side
-- from `nivel_hemoglobina` and never trusted from this table.
--
-- Still gated on credentials + `supabase db advisors` review before apply.

create table if not exists public.pacientes (
  -- text (not uuid): accepts both crypto.randomUUID ids and the store's
  -- test/fallback `p-...` ids without loss.
  id text primary key,
  -- Owner of the row. Defaults to the caller's auth.uid() so the client
  -- never sends a user id; WITH CHECK policies below block spoofing.
  user_id uuid not null default auth.uid() references auth.users(id),
  nombre text not null check (char_length(nombre) > 0),
  edad_meses integer not null check (edad_meses between 6 and 59),
  nivel_hemoglobina double precision not null check (nivel_hemoglobina > 0),
  -- Display cache only; sync recomputes it from nivel_hemoglobina (see src/lib/sync.ts).
  diagnostico text not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.pacientes enable row level security;

-- Per-user policies. Auth model: one user owns their rows via user_id.
-- UPDATE needs the SELECT policy below first, otherwise updates silently
-- affect 0 rows (Postgres RLS must SELECT the row before updating it).

create policy "pacientes_select_own"
  on public.pacientes for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy "pacientes_insert_own"
  on public.pacientes for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "pacientes_update_own"
  on public.pacientes for update
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create policy "pacientes_delete_own"
  on public.pacientes for delete
  to authenticated
  using ( (select auth.uid()) = user_id );

create index if not exists pacientes_updated_at_idx
  on public.pacientes (updated_at desc);
