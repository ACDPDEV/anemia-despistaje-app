-- ROLLBACK for 20261003000000_create_pacientes.sql.
-- GATED under the same blockers (no creds, RLS review pending): staged only,
-- never applied. Local padron data (localStorage) is untouched by this file.

drop policy if exists "pilot_allow_all" on public.pacientes;
drop table if exists public.pacientes;
