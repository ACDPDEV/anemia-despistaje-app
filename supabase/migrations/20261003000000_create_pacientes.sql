-- GATED MIGRATION — DO NOT APPLY YET.
-- Blocked on: Supabase project URL + anon key (unknown) and pilot RLS policy review.
-- Rollback: 20261003000000_create_pacientes.down.sql (DROP TABLE).
-- Local app is unaffected: the offline-first padron (Zustand + localStorage)
-- is the source of truth; `diagnostico` is always recomputed client-side
-- from `nivel_hemoglobina` and never trusted from this table.

create table if not exists public.pacientes (
  -- text (not uuid): accepts both crypto.randomUUID ids and the store's
  -- test/fallback `p-...` ids without loss.
  id text primary key,
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

-- PILOT-ONLY permissive policy. REQUIRES RLS REVIEW with the pilot auth
-- decision before this migration may run anywhere beyond a scratch project.
create policy "pilot_allow_all"
  on public.pacientes for all
  using (true)
  with check (true);

create index if not exists pacientes_updated_at_idx
  on public.pacientes (updated_at desc);
