import { describe, it, expect, vi, beforeEach } from "vitest";
import * as guard from "./syncGuard";
import {
  DEFAULT_PULL_COOLDOWN_MS,
  PULL_COOLDOWN_MESSAGE,
  formatLastSyncAgo,
  guardedPull,
  recordPull,
  resetSyncGuardForTests,
  runGuarded,
  shouldSkipPull,
} from "./syncGuard";
import { NO_PENDING_MESSAGE, pushDirty, type RemotePacienteRow } from "./sync";
import type { Paciente } from "../stores/padronStore";

function makeLocal(overrides: Partial<Paciente> = {}): Paciente {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    nombre: "Ana Quispe",
    edadMeses: 24,
    nivelHemoglobina: 9.5,
    diagnostico: "Anemia Moderada",
    updatedAt: "2026-10-01T10:00:00.000Z",
    dirty: false,
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

beforeEach(() => {
  resetSyncGuardForTests();
});

describe("runGuarded in-flight lock", () => {
  it("skips a concurrent second invoke and clears the flag after success", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = runGuarded(async () => {
      await gate;
      return "first";
    });
    // The first call holds the lock synchronously, so this one must skip.
    expect(guard.isSyncing).toBe(true);
    const second = await runGuarded(async () => "second");
    expect(second).toEqual({ skipped: "in-flight" });

    release();
    const firstResult = await first;
    expect(firstResult).toEqual({ skipped: false, value: "first" });
    expect(guard.isSyncing).toBe(false);
  });

  it("clears the flag via finally when the wrapped fn throws", async () => {
    await expect(
      runGuarded(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(guard.isSyncing).toBe(false);

    // The guard is usable again right after the failure.
    const next = await runGuarded(async () => 42);
    expect(next).toEqual({ skipped: false, value: 42 });
    expect(guard.isSyncing).toBe(false);
  });
});

describe("pull cooldown", () => {
  it("exposes the Spanish label helpers", () => {
    expect(formatLastSyncAgo(7)).toBe("Última sincronización hace 7s");
  });

  it("escalates the receipt honestly across seconds, minutes, and hours", () => {
    expect(formatLastSyncAgo(5)).toBe("Última sincronización hace 5s");
    expect(formatLastSyncAgo(59)).toBe("Última sincronización hace 59s");
    expect(formatLastSyncAgo(60)).toBe("Última sincronización hace 1 min");
    expect(formatLastSyncAgo(3599)).toBe("Última sincronización hace 59 min");
    expect(formatLastSyncAgo(3600)).toBe("Última sincronización hace 1 h");
    expect(formatLastSyncAgo(7261)).toBe("Última sincronización hace 2 h");
  });

  it("clamps negatives and floors fractions without invented precision", () => {
    expect(formatLastSyncAgo(-5)).toBe("Última sincronización ahora mismo");
    expect(formatLastSyncAgo(7.9)).toBe("Última sincronización hace 7s");
    expect(formatLastSyncAgo(119.9)).toBe("Última sincronización hace 1 min");
  });

  it("reads ahora mismo in the first seconds instead of hace 0s (t=0 edge)", () => {
    expect(formatLastSyncAgo(0)).toBe("Última sincronización ahora mismo");
    expect(formatLastSyncAgo(4)).toBe("Última sincronización ahora mismo");
    expect(formatLastSyncAgo(4.9)).toBe("Última sincronización ahora mismo");
    expect(formatLastSyncAgo(5)).toBe("Última sincronización hace 5s");
  });

  it("skips fetchAll within the window and runs after it", async () => {
    const fetchAll = vi.fn(async () => [makeRemote()]);
    const table = { fetchAll, upsert: vi.fn(async () => {}) };
    const local = [makeLocal()];

    recordPull(1_000);
    expect(shouldSkipPull(1_000 + 5_000)).toBe(true);

    const skipped = await guardedPull(local, table, true, { now: 1_000 + 5_000 });
    expect(skipped.skipped).toBe("cooldown");
    expect(skipped.message).toBe(PULL_COOLDOWN_MESSAGE);
    expect(fetchAll).toHaveBeenCalledTimes(0);
    expect(guard.isSyncing).toBe(false);

    const afterWindow = await guardedPull(local, table, true, {
      now: 1_000 + DEFAULT_PULL_COOLDOWN_MS + 1,
    });
    expect(afterWindow.skipped).toBeUndefined();
    expect(afterWindow.ok).toBe(true);
    expect(fetchAll).toHaveBeenCalledTimes(1);
    expect(guard.isSyncing).toBe(false);
  });

  it("does not start the cooldown on offline attempts (no fetch, no window)", async () => {
    const fetchAll = vi.fn(async () => [makeRemote()]);
    const table = { fetchAll, upsert: vi.fn(async () => {}) };

    const offline = await guardedPull([makeLocal()], table, false, { now: 2_000 });
    expect(offline.ok).toBe(false);
    expect(fetchAll).toHaveBeenCalledTimes(0);
    expect(shouldSkipPull(2_001)).toBe(false);
  });
});

describe("formatSyncOffline (offline-clean vocabulary)", () => {
  it("reads bare offline when clean, queue depth only when pending", () => {
    expect(guard.formatSyncOffline(0)).toBe("Sin conexión");
    expect(guard.formatSyncOffline(1)).toBe("Sin conexión · 1 por sincronizar");
    expect(guard.formatSyncOffline(3)).toBe("Sin conexión · 3 por sincronizar");
  });
});

describe("push skip-when-clean pin (sync.ts behavior unchanged)", () => {
  it("stays a no-op with the Spanish pending message when nothing is dirty", async () => {
    const upsert = vi.fn(async (_rows: RemotePacienteRow[]) => {});
    const table = { fetchAll: vi.fn(async () => [] as RemotePacienteRow[]), upsert };

    const result = await pushDirty([makeLocal({ dirty: false })], table, true);

    expect(result.ok).toBe(true);
    expect(result.pushedIds).toEqual([]);
    expect(result.message).toBe("No hay cambios pendientes de sincronización.");
    expect(result.message).toBe(NO_PENDING_MESSAGE);
    expect(upsert).toHaveBeenCalledTimes(0);
  });
});
