import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { usePadronStore } from "../stores/padronStore";
import { SyncStatusChip } from "./SyncStatusChip";
import { pushDirty } from "../lib/sync";
import * as guard from "../lib/syncGuard";
import { resetSyncGuardForTests } from "../lib/syncGuard";

// The chip owns the first sync call-site, so sync I/O is mocked at the
// module seams while the real guard runs (in-flight + cooldown untouched).
vi.mock("../lib/supabase", () => ({
  getSupabaseClient: vi.fn(() => ({ from: () => ({}) })),
}));

vi.mock("../lib/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/sync")>();
  return {
    ...actual,
    pushDirty: vi.fn(),
    createSupabaseSyncTable: vi.fn(() => ({
      fetchAll: vi.fn(async () => []),
      upsert: vi.fn(async () => {}),
    })),
  };
});

vi.mock("../lib/syncGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/syncGuard")>();
  return {
    ...actual,
    // Spread copies the isSyncing/lastPullAt primitives by value; re-expose
    // them live so the chip's subscription reads the real values.
    get isSyncing() {
      return actual.isSyncing;
    },
    get lastPullAt() {
      return actual.lastPullAt;
    },
    runGuarded: vi.fn((fn: () => Promise<never>) => actual.runGuarded(fn)),
    guardedPull: vi.fn(async () => {
      // Mirror the real guardedPull: a successful pull opens the cooldown
      // window and notifies subscribers so the receipt line updates live.
      actual.recordPull();
      return {
        ok: true,
        merged: usePadronStore.getState().pacientes,
        message: "Sincronizado.",
      };
    }),
  };
});

const pushMock = vi.mocked(pushDirty);
const runGuardedSpy = vi.mocked(guard.runGuarded);
const guardedPullMock = vi.mocked(guard.guardedPull);

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    configurable: true,
  });
}

function seedDirty(): string {
  const { add } = usePadronStore.getState();
  add({ nombre: "Ana Torres", edadMeses: 24, nivelHemoglobina: 12.0 });
  return usePadronStore.getState().pacientes[0].id;
}

function statusText(): string {
  return within(screen.getByTestId("sync-status-chip"))
    .getByRole("status")
    .textContent?.trim() ?? "";
}

beforeEach(() => {
  localStorage.clear();
  usePadronStore.getState().reset();
  resetSyncGuardForTests();
  setOnline(true);
  vi.clearAllMocks();
  pushMock.mockResolvedValue({
    ok: true,
    pushedIds: [],
    message: "No hay cambios pendientes de sincronización.",
  });
});

afterEach(() => {
  setOnline(true);
});

describe("SyncStatusChip", () => {
  it("reports safety on this device when online with nothing pending", () => {
    render(<SyncStatusChip />);
    expect(statusText()).toBe("A salvo en este equipo");
    // Clean state stays quiet: text only, no action.
    expect(
      screen.queryByRole("button", { name: /sincronizar/i }),
    ).not.toBeInTheDocument();
  });

  it("counts dirty rows as pending when online", () => {
    const { add } = usePadronStore.getState();
    add({ nombre: "Ana Torres", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Luis Paz", edadMeses: 30, nivelHemoglobina: 6.5 });
    render(<SyncStatusChip />);
    expect(statusText()).toBe("2 por sincronizar");
  });

  it("includes tombstones in the pending count", () => {
    const { add, remove } = usePadronStore.getState();
    add({ nombre: "Ana Torres", edadMeses: 24, nivelHemoglobina: 12.0 });
    remove(usePadronStore.getState().pacientes[0].id);
    render(<SyncStatusChip />);
    // Soft-deleted but still dirty: queued for push, never hidden here.
    expect(statusText()).toBe("1 por sincronizar");
  });

  it("names the offline state with the pending count and offers no action", () => {
    setOnline(false);
    const { add } = usePadronStore.getState();
    add({ nombre: "Ana Torres", edadMeses: 24, nivelHemoglobina: 12.0 });
    render(<SyncStatusChip />);
    expect(statusText()).toBe("Sin conexión · 1 pendientes");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("reacts to offline/online events without a reload", () => {
    render(<SyncStatusChip />);
    expect(statusText()).toBe("A salvo en este equipo");
    act(() => {
      setOnline(false);
      fireEvent(window, new Event("offline"));
    });
    expect(statusText()).toMatch(/sin conexión/i);
    act(() => {
      setOnline(true);
      fireEvent(window, new Event("online"));
    });
    expect(statusText()).toBe("A salvo en este equipo");
  });

  it("announces as a polite live region", () => {
    render(<SyncStatusChip />);
    expect(
      within(screen.getByTestId("sync-status-chip")).getByRole("status"),
    ).toBeInTheDocument();
  });

  it("mirrors the full status text in the title for the collapsed sidebar", () => {
    const { rerender } = render(<SyncStatusChip />);
    expect(screen.getByTestId("sync-status-chip")).toHaveAttribute(
      "title",
      "A salvo en este equipo · Sin sincronizar aún",
    );
    seedDirty();
    rerender(<SyncStatusChip />);
    expect(screen.getByTestId("sync-status-chip")).toHaveAttribute(
      "title",
      "1 por sincronizar · Sin sincronizar aún",
    );
  });

  it("runs the guarded sync path and clears the pending count", async () => {
    const id = seedDirty();
    pushMock.mockResolvedValue({
      ok: true,
      pushedIds: [id],
      message: "Se sincronizó 1 registro con Supabase.",
    });
    render(<SyncStatusChip />);

    fireEvent.click(screen.getByRole("button", { name: /^sincronizar$/i }));

    await screen.findByText("A salvo en este equipo");
    expect(runGuardedSpy).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(guardedPullMock).toHaveBeenCalledTimes(1);
    expect(usePadronStore.getState().pacientes[0].dirty).toBe(false);
  });

  it("disables the action while syncing and names the operation", async () => {
    seedDirty();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    pushMock.mockImplementation(
      () =>
        gate.then(() => ({
          ok: true,
          pushedIds: [],
          message: "ok",
        })) as Promise<never>,
    );
    render(<SyncStatusChip />);

    fireEvent.click(screen.getByRole("button", { name: /^sincronizar$/i }));

    const syncing = await screen.findByRole("button", {
      name: /sincronizando/i,
    });
    expect(syncing).toBeDisabled();
    release();
    await screen.findByRole("button", { name: /^sincronizar$/i });
  });

  it("voices a push failure with its cause and retries on demand", async () => {
    const id = seedDirty();
    pushMock.mockResolvedValue({
      ok: true,
      pushedIds: [id],
      message: "Se sincronizó 1 registro con Supabase.",
    });
    pushMock.mockRejectedValueOnce(new Error("La red falló."));
    render(<SyncStatusChip />);

    fireEvent.click(screen.getByRole("button", { name: /^sincronizar$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("La red falló.");
    const retry = screen.getByRole("button", { name: /reintentar/i });
    expect(retry).toBeInTheDocument();

    fireEvent.click(retry);
    await screen.findByText("A salvo en este equipo");
    expect(pushMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("voices a refused push outcome without losing the queue", async () => {
    seedDirty();
    pushMock.mockResolvedValue({
      ok: false,
      pushedIds: [],
      message: "La sincronización no está configurada.",
    });
    render(<SyncStatusChip />);

    fireEvent.click(screen.getByRole("button", { name: /^sincronizar$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La sincronización no está configurada.",
    );
    // Nothing was pushed: the row stays dirty and pending.
    expect(statusText()).toBe("1 por sincronizar");
    expect(usePadronStore.getState().pacientes[0].dirty).toBe(true);
  });

  it("collects a pushed tombstone after a successful sync", async () => {
    const { add, remove } = usePadronStore.getState();
    add({ nombre: "Ana Torres", edadMeses: 24, nivelHemoglobina: 12.0 });
    const id = usePadronStore.getState().pacientes[0].id;
    remove(id);
    pushMock.mockResolvedValue({
      ok: true,
      pushedIds: [id],
      message: "Se sincronizó 1 registro con Supabase.",
    });
    guardedPullMock.mockResolvedValueOnce({
      ok: true,
      merged: [],
      message: "Sin cambios remotos.",
    });
    render(<SyncStatusChip />);

    fireEvent.click(screen.getByRole("button", { name: /^sincronizar$/i }));

    await screen.findByText("A salvo en este equipo");
    expect(usePadronStore.getState().pacientes).toHaveLength(0);
  });

  it("gives the sync action a coarse-pointer minimum height", () => {
    seedDirty();
    render(<SyncStatusChip />);
    expect(
      screen.getByRole("button", { name: /^sincronizar$/i }).className,
    ).toMatch(/pointer-coarse:min-h-11/);
  });

  it("keeps a mid-flight edit dirty: push-then-mark never clears newer updatedAt", async () => {
    const id = seedDirty();
    // Pin the snapshot timestamp: update() stamps wall-clock now, so the
    // mid-flight edit always moves updatedAt (no same-millisecond flake).
    usePadronStore.setState((state) => ({
      pacientes: state.pacientes.map((p) => ({
        ...p,
        updatedAt: "2026-10-01T10:00:00.000Z",
      })),
    }));
    // The edit lands after the pre-push snapshot but before markSynced:
    // pushedIds still name the row, yet its updatedAt moved on.
    pushMock.mockImplementationOnce(async () => {
      usePadronStore.getState().update(id, { nombre: "Ana Editada" });
      return {
        ok: true,
        pushedIds: [id],
        message: "Se sincronizó 1 registro con Supabase.",
      };
    });
    render(<SyncStatusChip />);

    fireEvent.click(screen.getByRole("button", { name: /^sincronizar$/i }));

    await screen.findByText("1 por sincronizar");
    const row = usePadronStore.getState().pacientes[0];
    expect(row.nombre).toBe("Ana Editada");
    expect(row.dirty).toBe(true);
  });

  it("shows an honest never-synced receipt instead of a timeless claim", () => {
    render(<SyncStatusChip />);
    expect(screen.getByTestId("sync-receipt")).toHaveTextContent(
      "Sin sincronizar aún",
    );
  });

  it("surfaces the last-sync timestamp live after a sync completes", async () => {
    const id = seedDirty();
    pushMock.mockResolvedValue({
      ok: true,
      pushedIds: [id],
      message: "Se sincronizó 1 registro con Supabase.",
    });
    render(<SyncStatusChip />);
    expect(screen.getByTestId("sync-receipt")).toHaveTextContent(
      "Sin sincronizar aún",
    );

    fireEvent.click(screen.getByRole("button", { name: /^sincronizar$/i }));

    await screen.findByText(/última sincronización hace \d+s/i);
    expect(screen.getByTestId("sync-receipt")).toHaveTextContent(
      /última sincronización hace \d+s/i,
    );
  });
});
