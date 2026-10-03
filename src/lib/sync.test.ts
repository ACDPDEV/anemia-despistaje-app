import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the supabase-js client: no live network calls in tests (creds unknown,
// deferred-safe). The lazy client in ./supabase must use this mock.
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ __mockSupabaseClient: true })),
}));

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  resetSupabaseClientForTests,
} from "./supabase";
import {
  OFFLINE_MESSAGE,
  UNCONFIGURED_MESSAGE,
  toRemoteRow,
  fromRemoteRow,
  getDirtyPacientes,
  markClean,
  mergePacientes,
  pushDirty,
  pullRemote,
  createSupabaseSyncTable,
  type RemotePacienteRow,
  type SyncTable,
} from "./sync";
import type { Paciente } from "../stores/padronStore";

const mockedCreateClient = vi.mocked(createClient);

function makeLocal(overrides: Partial<Paciente> = {}): Paciente {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    nombre: "Ana Quispe",
    edadMeses: 24,
    nivelHemoglobina: 9.5,
    diagnostico: "Anemia Moderada",
    updatedAt: "2026-10-01T10:00:00.000Z",
    dirty: true,
    deletedAt: null,
    ...overrides,
  };
}

function makeRemote(overrides: Partial<RemotePacienteRow> = {}): RemotePacienteRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    nombre: "Ana Quispe",
    edad_meses: 24,
    nivel_hemoglobina: 9.5,
    diagnostico: "Anemia Moderada",
    updated_at: "2026-10-01T10:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeFakeTable(remote: RemotePacienteRow[] = []): SyncTable & {
  upserted: RemotePacienteRow[][];
  upsertCalls: number;
} {
  const table = {
    upserted: [] as RemotePacienteRow[][],
    upsertCalls: 0,
    fetchAll: async () => remote,
    upsert: async (rows: RemotePacienteRow[]) => {
      table.upsertCalls += 1;
      table.upserted.push(rows);
    },
  };
  return table;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  resetSupabaseClientForTests();
  mockedCreateClient.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("supabase lazy client (deferred-safe)", () => {
  it("is a no-op without credentials: null client, not configured, no client created", () => {
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseClient()).toBeNull();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("creates and caches a single client once credentials are present", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");

    expect(isSupabaseConfigured()).toBe(true);
    const first = getSupabaseClient();
    const second = getSupabaseClient();

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(mockedCreateClient).toHaveBeenCalledTimes(1);
    expect(mockedCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "test-anon-key",
    );
  });
});

describe("pushDirty", () => {
  it("reports the Spanish offline message and keeps the dirty queue when offline", async () => {
    const local = [makeLocal(), makeLocal({ id: "22222222-2222-4222-8222-222222222222" })];
    const table = makeFakeTable();

    const result = await pushDirty(local, table, false);

    expect(result.ok).toBe(false);
    expect(result.pushedIds).toEqual([]);
    expect(result.message).toBe(
      "Sin conexión. Los cambios están guardados en este equipo y se sincronizarán más tarde.",
    );
    expect(result.message).toBe(OFFLINE_MESSAGE);
    expect(table.upsertCalls).toBe(0);
    // No data loss: every row is still dirty and queued.
    expect(getDirtyPacientes(local)).toHaveLength(2);
  });

  it("reports the Spanish unconfigured message when the table is missing but online", async () => {
    const result = await pushDirty([makeLocal()], null, true);

    expect(result.ok).toBe(false);
    expect(result.pushedIds).toEqual([]);
    expect(result.message).toBe(
      "La sincronización no está configurada. Faltan las credenciales de Supabase.",
    );
    expect(result.message).toBe(UNCONFIGURED_MESSAGE);
  });

  it("uploads queued dirty rows as snake_case and returns their ids for clean-marking", async () => {
    const clean = makeLocal({
      id: "22222222-2222-4222-8222-222222222222",
      dirty: false,
    });
    const local = [makeLocal(), clean];
    const table = makeFakeTable();

    const result = await pushDirty(local, table, true);

    expect(result.ok).toBe(true);
    expect(result.pushedIds).toEqual([makeLocal().id]);
    expect(result.message).toBe("Se sincronizó 1 registro con Supabase.");
    expect(table.upsertCalls).toBe(1);
    expect(table.upserted[0]).toHaveLength(1);
    expect(table.upserted[0][0]).toMatchObject({
      id: makeLocal().id,
      nombre: "Ana Quispe",
      edad_meses: 24,
      nivel_hemoglobina: 9.5,
      updated_at: "2026-10-01T10:00:00.000Z",
    });
    // Caller marks clean with the returned ids; clean rows stay clean.
    const next = markClean(local, result.pushedIds);
    expect(getDirtyPacientes(next)).toHaveLength(0);
  });

  it("is a no-op with a Spanish pending message when nothing is dirty", async () => {
    const table = makeFakeTable();
    const result = await pushDirty([makeLocal({ dirty: false })], table, true);

    expect(result.ok).toBe(true);
    expect(result.pushedIds).toEqual([]);
    expect(result.message).toBe("No hay cambios pendientes de sincronización.");
    expect(table.upsertCalls).toBe(0);
  });
});

describe("pullRemote", () => {
  it("reports the Spanish offline message and returns local data untouched when offline", async () => {
    const local = [makeLocal()];
    const table = makeFakeTable([makeRemote({ nivel_hemoglobina: 12.0 })]);

    const result = await pullRemote(local, table, false);

    expect(result.ok).toBe(false);
    expect(result.message).toBe(OFFLINE_MESSAGE);
    expect(result.merged).toEqual(local);
    expect(getDirtyPacientes(result.merged)).toHaveLength(1);
  });

  it("merges with last-write-wins: newer remote wins, older remote loses, remote-only rows join", async () => {
    const localNewer = makeLocal({
      id: "a",
      nivelHemoglobina: 8.0,
      diagnostico: "Anemia Moderada",
      updatedAt: "2026-10-02T10:00:00.000Z",
    });
    const localOlder = makeLocal({
      id: "b",
      nombre: "Luis Paredes",
      nivelHemoglobina: 12.0,
      diagnostico: "Normal",
      updatedAt: "2026-10-01T10:00:00.000Z",
    });
    const table = makeFakeTable([
      makeRemote({ id: "a", nivel_hemoglobina: 12.5, updated_at: "2026-10-01T09:00:00.000Z" }),
      makeRemote({
        id: "b",
        nombre: "Luis Paredes",
        nivel_hemoglobina: 8.0,
        diagnostico: "Normal", // stale/wrong remote label: MUST be recomputed, never trusted
        updated_at: "2026-10-02T09:00:00.000Z",
      }),
      makeRemote({
        id: "c",
        nombre: "Rosa Diaz",
        nivel_hemoglobina: 6.5,
        diagnostico: "Anemia Severa",
        updated_at: "2026-10-02T11:00:00.000Z",
      }),
    ]);

    const result = await pullRemote([localNewer, localOlder], table, true);

    expect(result.ok).toBe(true);
    expect(result.message).toBe("Se recibieron 3 registros desde Supabase.");
    expect(result.merged).toHaveLength(3);

    // Local row "a" is newer: kept verbatim, still dirty for the next push.
    const kept = result.merged.find((p) => p.id === "a")!;
    expect(kept.nivelHemoglobina).toBe(8.0);
    expect(kept.diagnostico).toBe("Anemia Moderada");
    expect(kept.dirty).toBe(true);

    // Remote row "b" is newer: remote values win, diagnosis recomputed, marked clean.
    const taken = result.merged.find((p) => p.id === "b")!;
    expect(taken.nivelHemoglobina).toBe(8.0);
    expect(taken.diagnostico).toBe("Anemia Moderada");
    expect(taken.dirty).toBe(false);

    // Remote-only row "c" joins the padron, clean.
    const joined = result.merged.find((p) => p.id === "c")!;
    expect(joined.nombre).toBe("Rosa Diaz");
    expect(joined.diagnostico).toBe("Anemia Severa");
    expect(joined.dirty).toBe(false);
  });

  it("keeps the local row on equal timestamps and drops rows whose winning version is deleted", () => {
    const merged = mergePacientes(
      [makeLocal({ id: "t", updatedAt: "2026-10-02T10:00:00.000Z" })],
      [
        makeRemote({ id: "t", updated_at: "2026-10-02T10:00:00.000Z" }),
        makeRemote({
          id: "gone",
          updated_at: "2026-10-03T10:00:00.000Z",
          deleted_at: "2026-10-03T10:00:00.000Z",
        }),
      ],
    );

    expect(merged.map((p) => p.id)).toEqual(["t"]);
    expect(merged.find((p) => p.id === "gone")).toBeUndefined();
  });
});

describe("row mapping", () => {
  it("round-trips local to remote and back, always recomputing the diagnosis", () => {
    const remote = toRemoteRow(makeLocal({ nivelHemoglobina: 10.5 }));
    expect(remote.edad_meses).toBe(24);
    expect(remote.nivel_hemoglobina).toBe(10.5);

    const back = fromRemoteRow({ ...remote, diagnostico: "Anemia Severa" });
    expect(back.diagnostico).toBe("Anemia Leve");
    expect(back.dirty).toBe(false);
    expect(back.nivelHemoglobina).toBe(10.5);
  });
});

describe("createSupabaseSyncTable", () => {
  it("reads and writes through the supabase table handle and surfaces errors", async () => {
    const rows = [makeRemote()];
    const upsertSpy = vi.fn(async (_rows: unknown) => ({ error: null }));
    const fakeClient = {
      from: (table: string) => {
        expect(table).toBe("pacientes");
        return {
          select: async (_cols?: string) => ({ data: rows, error: null }),
          upsert: upsertSpy,
        };
      },
    };

    const table = createSupabaseSyncTable(fakeClient as unknown as SupabaseClient);
    await expect(table.fetchAll()).resolves.toEqual(rows);

    await table.upsert(rows);
    expect(upsertSpy).toHaveBeenCalledWith(rows);

    const failing = createSupabaseSyncTable({
      from: () => ({
        select: async () => ({ data: null, error: { message: "boom" } }),
        upsert: async () => ({ error: { message: "boom" } }),
      }),
    } as unknown as SupabaseClient);
    await expect(failing.fetchAll()).rejects.toThrow("boom");
    await expect(failing.upsert(rows)).rejects.toThrow("boom");
  });
});
