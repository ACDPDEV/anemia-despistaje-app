-- ROLLBACK for 20261003000000_create_pacientes.sql.
-- GATED under the same blockers (no creds, advisors review pending, per-user
-- auth smoke test pending): staged only, never applied. Local padron data
-- (localStorage) is untouched by this file.

drop policy if exists "pacientes_select_own" on public.pacientes;
drop policy if exists "pacientes_insert_own" on public.pacientes;
drop policy if exists "pacientes_update_own" on public.pacientes;
drop policy if exists "pacientes_delete_own" on public.pacientes;
drop table if exists public.pacientes;
