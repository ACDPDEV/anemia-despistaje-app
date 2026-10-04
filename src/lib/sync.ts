import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluatePatient } from "../domain/anemia";
import type { Paciente } from "../stores/padronStore";

// Manual, offline-tolerant sync between the local padron (source of truth)
// and Supabase (deferred remote replica). No auto-sync: every function runs
// only on explicit user action. `diagnostico` is always recomputed from
// `nivelHemoglobina` and never trusted from the remote row.

// User-facing copy is Spanish; code and comments stay in English.
export const OFFLINE_MESSAGE =
  "Sin conexión. Los cambios están guardados en este equipo y se sincronizarán más tarde.";
export const UNCONFIGURED_MESSAGE =
  "La sincronización no está configurada. Faltan las credenciales de Supabase.";
export const NO_PENDING_MESSAGE = "No hay cambios pendientes de sincronización.";

// Remote row mirrors Paciente in snake_case (see supabase/migrations).
export interface RemotePacienteRow {
  id: string;
  nombre: string;
  edad_meses: number;
  nivel_hemoglobina: number;
  diagnostico?: string | null;
  updated_at: string;
  deleted_at?: string | null;
}

// Narrow seam over the "pacientes" table: the only Supabase surface sync needs.
// Tests inject fakes; production passes createSupabaseSyncTable(client).
export interface SyncTable {
  fetchAll: () => Promise<RemotePacienteRow[]>;
  upsert: (rows: RemotePacienteRow[]) => Promise<void>;
}

export interface PushOutcome {
  ok: boolean;
  pushedIds: string[];
  message: string;
}

export interface PullOutcome {
  ok: boolean;
  merged: Paciente[];
  message: string;
}

export function toRemoteRow(p: Paciente): RemotePacienteRow {
  return {
    id: p.id,
    nombre: p.nombre,
    edad_meses: p.edadMeses,
    nivel_hemoglobina: p.nivelHemoglobina,
    diagnostico: p.diagnostico,
    updated_at: p.updatedAt,
    deleted_at: p.deletedAt ?? null,
  };
}

export function fromRemoteRow(r: RemotePacienteRow): Paciente {
  return {
    id: r.id,
    nombre: r.nombre,
    edadMeses: r.edad_meses,
    nivelHemoglobina: r.nivel_hemoglobina,
    // Never trust the remote label: recompute from hemoglobin.
    diagnostico: evaluatePatient(r.nivel_hemoglobina),
    updatedAt: r.updated_at,
    dirty: false,
    deletedAt: r.deleted_at ?? null,
  };
}

export function getDirtyPacientes(local: Paciente[]): Paciente[] {
  return local.filter((p) => p.dirty);
}

export function markClean(local: Paciente[], ids: string[]): Paciente[] {
  const pushed = new Set(ids);
  return local.map((p) => (pushed.has(p.id) ? { ...p, dirty: false } : p));
}

// Last-write-wins merge on updatedAt (ISO strings compare chronologically).
// Local order is preserved; remote-only rows append in remote order. A row
// whose winning version carries deletedAt is dropped (tombstone).
export function mergePacientes(local: Paciente[], remote: RemotePacienteRow[]): Paciente[] {
  const byId = new Map<string, RemotePacienteRow>();
  for (const row of remote) byId.set(row.id, row);

  const merged: Paciente[] = [];
  const seen = new Set<string>();

  for (const p of local) {
    seen.add(p.id);
    const row = byId.get(p.id);
    if (!row) {
      merged.push(p);
      continue;
    }
    if ((row.deleted_at ?? null) && row.updated_at >= p.updatedAt) continue;
    if (row.updated_at > p.updatedAt) {
      merged.push(fromRemoteRow(row));
    } else {
      merged.push(p);
    }
  }

  for (const row of remote) {
    if (seen.has(row.id)) continue;
    if (row.deleted_at ?? null) continue;
    merged.push(fromRemoteRow(row));
  }

  return merged;
}

export async function pushDirty(
  local: Paciente[],
  table: SyncTable | null,
  isOnline: boolean,
): Promise<PushOutcome> {
  if (!isOnline) return { ok: false, pushedIds: [], message: OFFLINE_MESSAGE };
  if (!table) return { ok: false, pushedIds: [], message: UNCONFIGURED_MESSAGE };

  const dirty = getDirtyPacientes(local);
  if (dirty.length === 0) return { ok: true, pushedIds: [], message: NO_PENDING_MESSAGE };

  await table.upsert(dirty.map(toRemoteRow));
  const pushedIds = dirty.map((p) => p.id);
  return {
    ok: true,
    pushedIds,
    message:
      dirty.length === 1
        ? "Se sincronizó 1 registro con Supabase."
        : `Se sincronizaron ${dirty.length} registros con Supabase.`,
  };
}

export async function pullRemote(
  local: Paciente[],
  table: SyncTable | null,
  isOnline: boolean,
): Promise<PullOutcome> {
  if (!isOnline) return { ok: false, merged: local, message: OFFLINE_MESSAGE };
  if (!table) return { ok: false, merged: local, message: UNCONFIGURED_MESSAGE };

  const rows = await table.fetchAll();
  const merged = mergePacientes(local, rows);
  return {
    ok: true,
    merged,
    message:
      rows.length === 1
        ? "Se recibió 1 registro desde Supabase."
        : `Se recibieron ${rows.length} registros desde Supabase.`,
  };
}

interface SupabaseSelectPage {
  data: unknown;
  error: { message: string } | null;
}

// Select result plus the optional PostgREST range window. supabase-js v2
// (postgrest-js) `select()` returns a FilterBuilder that is thenable AND
// carries `.range(from, to)`; plain-promise fakes without `range` keep
// working through the single-select fallback below.
interface SupabaseRangeableQuery extends Promise<SupabaseSelectPage> {
  range?: (from: number, to: number) => Promise<SupabaseSelectPage>;
}

interface SupabaseTableHandle {
  select: (columns?: string) => SupabaseRangeableQuery;
  upsert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
}

// PostgREST default page size: fetchAll walks range() windows until a
// short page (< PAGE_SIZE) proves the table is exhausted.
export const SYNC_PAGE_SIZE = 1000;

// Production adapter: binds the SyncTable seam to a real Supabase client.
// Never called without credentials (getSupabaseClient returns null first).
export function createSupabaseSyncTable(client: SupabaseClient): SyncTable {
  const handle = client.from("pacientes") as unknown as SupabaseTableHandle;
  return {
    fetchAll: async () => {
      const all: RemotePacienteRow[] = [];
      let from = 0;
      for (;;) {
        const query = handle.select("*");
        if (typeof query.range !== "function") {
          const { data, error } = await query;
          if (error) throw new Error(error.message);
          return (data ?? []) as RemotePacienteRow[];
        }
        const { data, error } = await query.range(from, from + SYNC_PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as RemotePacienteRow[];
        all.push(...rows);
        if (rows.length < SYNC_PAGE_SIZE) return all;
        from += SYNC_PAGE_SIZE;
      }
    },
    upsert: async (rows) => {
      const { error } = await handle.upsert(rows);
      if (error) throw new Error(error.message);
    },
  };
}
