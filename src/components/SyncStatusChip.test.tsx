import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { usePadronStore } from "../stores/padronStore";
import { PhoneSyncRow, SyncStatusChip } from "./SyncStatusChip";
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
    // Spread copies the isSyncing/lastPullAt/lastSyncError primitives by
    // value; re-expose them live so the chip's subscription reads the real
    // values.
    get isSyncing() {
      return actual.isSyncing;
    },
    get lastPullAt() {
      return actual.lastPullAt;
    },
    get lastSyncError() {
      return actual.lastSyncError;
    },
    get lastSyncErrorAt() {
      return actual.lastSyncErrorAt;
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
  it("reports honest never-synced state on this device when clean", () => {
    render(<SyncStatusChip />);
    expect(statusText()).toBe("A salvo en este equipo");
    // Clean state stays quiet: text only, no action.
    expect(
      screen.queryByRole("button", { name: /sincronizar/i }),
    ).not.toBeInTheDocument();
  });

  it("claims safety only after a real pull", () => {
    guard.recordPull(Date.now() - 5_000);
    render(<SyncStatusChip />);
    expect(statusText()).toBe("A salvo en este equipo");
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
    expect(statusText()).toBe("Sin conexión · 1 por sincronizar");
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

  it("keeps the receipt silent: one live region, no ticking announcements", () => {
    render(<SyncStatusChip />);
    const chip = screen.getByTestId("sync-status-chip");
    // The pending-count line stays the chip's single announcer…
    expect(within(chip).getAllByRole("status")).toHaveLength(1);
    // …and the receipt (which re-renders on a 5s/30s tick) carries no
    // live role, so fresh syncs never announce "hace 5s… hace 10s…".
    const receipt = screen.getByTestId("sync-receipt");
    expect(receipt).not.toHaveAttribute("role");
    expect(receipt).not.toHaveAttribute("aria-live");
    expect(receipt).toHaveTextContent("Aún sin sincronizar");
  });

  it("names the collapsed chip with the composed Spanish title", () => {
    render(<SyncStatusChip collapsed />);
    const chip = screen.getByTestId("sync-status-chip");
    const title = chip.getAttribute("title")!;
    expect(title).toBe(
      "A salvo en este equipo · Aún sin sincronizar",
    );
    // The accessible name stays STATIC (status text only): the title
    // tooltip carries the receipt mouse-only, never the live name.
    expect(within(chip).getByRole("status")).toHaveAttribute(
      "aria-label",
      "A salvo en este equipo",
    );
  });

  it("mirrors the full status text in the title for the collapsed sidebar", () => {
    const { rerender } = render(<SyncStatusChip />);
    expect(screen.getByTestId("sync-status-chip")).toHaveAttribute(
      "title",
      "A salvo en este equipo · Aún sin sincronizar",
    );
    seedDirty();
    rerender(<SyncStatusChip />);
    expect(screen.getByTestId("sync-status-chip")).toHaveAttribute(
      "title",
      "1 por sincronizar · Aún sin sincronizar",
    );
  });

  it("collapses to an icon with badge and title when collapsed", () => {
    seedDirty();
    render(<SyncStatusChip collapsed />);

    const chip = screen.getByTestId("sync-status-chip");
    expect(chip).toHaveAttribute(
      "title",
      "1 por sincronizar · Aún sin sincronizar",
    );
    expect(screen.getByTestId("sync-pending-badge")).toHaveTextContent("1");
    // Full text lines stay out of the clipped icon-width footer.
    expect(screen.queryByTestId("sync-receipt")).not.toBeInTheDocument();
    // The collapsed icon carries a STATIC accessible name (status text +
    // pending count only): the ticking receipt lives mouse-only in the
    // title tooltip, never in the live name.
    expect(within(chip).getByRole("status")).toHaveAttribute(
      "aria-label",
      "1 por sincronizar",
    );
    expect(within(chip).getByRole("status").getAttribute("aria-label")).not.toBe(
      chip.getAttribute("title"),
    );
  });

  it("keeps the collapsed accessible name static across ticks", () => {
    vi.useFakeTimers();
    try {
      guard.recordPull(Date.now());
      render(<SyncStatusChip collapsed />);
      const chip = screen.getByTestId("sync-status-chip");
      const status = within(chip).getByRole("status");
      const before = status.getAttribute("aria-label")!;
      expect(before).toBe("A salvo en este equipo");
      // Fast 5s ticks re-render the receipt, then the 30s cadence: the
      // live name must never move (no "hace 5s…" announcements).
      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      const after = within(chip).getByRole("status").getAttribute("aria-label")!;
      expect(after).toBe(before);
      expect(after).not.toMatch(/hace/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides the badge when nothing is pending in collapsed mode", () => {
    render(<SyncStatusChip collapsed />);

    expect(screen.queryByTestId("sync-pending-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("sync-status-chip")).toHaveAttribute(
      "title",
      "A salvo en este equipo · Aún sin sincronizar",
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

  it("maps a raw English provider failure to Spanish at the alert surface", async () => {
    seedDirty();
    pushMock.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<SyncStatusChip />);

    fireEvent.click(screen.getByRole("button", { name: /^sincronizar$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Sin conexión. Revisa tu red e inténtalo de nuevo.",
    );
    expect(alert.textContent).not.toMatch(/fetch/i);
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
    guardedPullMock.mockImplementationOnce(async () => {
      guard.recordPull();
      return {
        ok: true,
        merged: [],
        message: "Sin cambios remotos.",
      };
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
      "Aún sin sincronizar",
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
      "Aún sin sincronizar",
    );

    fireEvent.click(screen.getByRole("button", { name: /^sincronizar$/i }));

    await screen.findByText(/última sincronización hace \d+s/i);
    expect(screen.getByTestId("sync-receipt")).toHaveTextContent(
      /última sincronización hace \d+s/i,
    );
  });

  it("escalates the receipt to minutes for older syncs", () => {
    guard.recordPull(Date.now() - 125_000);
    render(<SyncStatusChip />);
    expect(screen.getByTestId("sync-receipt")).toHaveTextContent(
      "Última sincronización hace 2 min",
    );
  });

  it("ticks fast (5s) within the first minute so the fresh receipt never goes stale", () => {
    vi.useFakeTimers();
    try {
      guard.recordPull(Date.now());
      const { unmount } = render(<SyncStatusChip />);
      expect(screen.getByTestId("sync-receipt")).toHaveTextContent(
        /última sincronización hace 0s/i,
      );
      // A 5s tick moves the seconds count while the sync is still fresh.
      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      expect(screen.getByTestId("sync-receipt")).toHaveTextContent(
        /última sincronización hace 5s/i,
      );
      // Fast ticks keep chaining until the minute boundary escalates.
      act(() => {
        vi.advanceTimersByTime(55_000);
      });
      expect(screen.getByTestId("sync-receipt")).toHaveTextContent(
        "Última sincronización hace 1 min",
      );
      // Cleanup on unmount: no timeout left ticking.
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("exposes Alt+G on the expanded sync action for the shell shortcut", () => {
    seedDirty();
    render(<SyncStatusChip />);
    const action = screen.getByRole("button", { name: /^sincronizar$/i });
    expect(action).toHaveAttribute("aria-keyshortcuts", "Alt+G");
    expect(action.getAttribute("title")).toContain("Alt+G");
    expect(action).toHaveAttribute("data-sync-action", "true");
  });

  it("keeps the sync action in collapsed mode with the Alt+G shortcut", async () => {
    const id = seedDirty();
    pushMock.mockResolvedValue({
      ok: true,
      pushedIds: [id],
      message: "Se sincronizó 1 registro con Supabase.",
    });
    render(<SyncStatusChip collapsed />);

    const action = screen.getByRole("button", { name: /^sincronizar$/i });
    expect(action).toHaveAttribute("aria-keyshortcuts", "Alt+G");
    expect(action.getAttribute("title")).toContain("Alt+G");
    expect(action.getAttribute("title")).toContain("1 por sincronizar");

    fireEvent.click(action);
    await waitFor(() => {
      expect(screen.queryByTestId("sync-pending-badge")).not.toBeInTheDocument();
    });
    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it("hides the collapsed sync action when there is nothing to sync", () => {
    render(<SyncStatusChip collapsed />);
    expect(
      screen.queryByRole("button", { name: /sincronizar|reintentar/i }),
    ).not.toBeInTheDocument();
  });

  it("backs off to the gentle 30s cadence once the receipt is over a minute old", () => {
    vi.useFakeTimers();
    try {
      guard.recordPull(Date.now() - 290_000);
      const { unmount } = render(<SyncStatusChip />);
      expect(screen.getByTestId("sync-receipt")).toHaveTextContent(
        "Última sincronización hace 4 min",
      );
      // No 5s tick fires on the slow path: the receipt holds still.
      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      expect(screen.getByTestId("sync-receipt")).toHaveTextContent(
        "Última sincronización hace 4 min",
      );
      // The 30s tick moves it at the next minute boundary.
      act(() => {
        vi.advanceTimersByTime(25_000);
      });
      expect(screen.getByTestId("sync-receipt")).toHaveTextContent(
        "Última sincronización hace 5 min",
      );
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("carries the failure in the collapsed accessible name with a retry cue and an error dot (no receipt)", async () => {
    const id = seedDirty();
    pushMock.mockResolvedValue({
      ok: true,
      pushedIds: [id],
      message: "Se sincronizó 1 registro con Supabase.",
    });
    pushMock.mockRejectedValueOnce(new Error("La red falló."));
    render(<SyncStatusChip collapsed />);

    fireEvent.click(screen.getByRole("button", { name: /^sincronizar$/i }));

    const chip = screen.getByTestId("sync-status-chip");
    const status = within(chip).getByRole("status");
    await waitFor(() => {
      expect(status.getAttribute("aria-label")).toMatch(/la red falló/i);
    });
    const name = status.getAttribute("aria-label")!;
    // Honest collapsed name: static status + error + retry affordance.
    expect(name).toMatch(/reintentar disponible/i);
    // Receipt stays out of the live name (no ticking announcements).
    expect(name).not.toMatch(/aún sin sincronizar/i);
    expect(name).not.toMatch(/última sincronización/i);
    expect(name).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    // Visible compact error signal on the icon button: destructive token,
    // absolute (no layout shift), hidden from AT (the name carries it).
    const dot = screen.getByTestId("sync-error-dot");
    expect(dot.className).toMatch(/bg-destructive/);
    expect(dot.className).toMatch(/absolute/);
    expect(dot).toHaveAttribute("aria-hidden", "true");
    // Reintentar stays the action and retries through the same handler.
    // Collapsed renders no visible text (icon only), so the recovery
    // reads off the accessible name, not findByText.
    const retry = screen.getByRole("button", { name: /reintentar/i });
    expect(retry).toBeInTheDocument();
    // The mouse-only tooltip mirrors the failure while it stands.
    expect(chip.getAttribute("title")).toMatch(/la red falló/i);
    fireEvent.click(retry);
    await waitFor(() => {
      expect(
        within(screen.getByTestId("sync-status-chip")).getByRole("status"),
      ).toHaveAttribute("aria-label", "A salvo en este equipo");
    });
    expect(pushMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("sync-error-dot")).not.toBeInTheDocument();
    // Collapsed never double-announces: the expanded/mobile role=alert
    // owns the failure, so no alert lives here.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows no error dot and keeps the static name when the collapsed chip is clean", () => {
    render(<SyncStatusChip collapsed />);
    const status = within(
      screen.getByTestId("sync-status-chip"),
    ).getByRole("status");
    expect(status).toHaveAttribute("aria-label", "A salvo en este equipo");
    expect(screen.queryByTestId("sync-error-dot")).not.toBeInTheDocument();
  });

  it("keeps the expanded failure surface unchanged (role=alert plus receipt)", async () => {
    seedDirty();
    pushMock.mockRejectedValueOnce(new Error("La red falló."));
    render(<SyncStatusChip />);

    fireEvent.click(screen.getByRole("button", { name: /^sincronizar$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("La red falló.");
    expect(screen.getByTestId("sync-receipt")).toBeInTheDocument();
  });
});

describe("shared module sync error (run-24 P2-2)", () => {
  it("shows a failure from one surface on the other with the identical string", async () => {
    seedDirty();
    pushMock.mockRejectedValueOnce(new Error("La red falló."));
    render(
      <>
        <SyncStatusChip />
        <PhoneSyncRow testId="phone" />
      </>,
    );

    // The chip fires; the phone row never ran a sync of its own.
    fireEvent.click(
      within(screen.getByTestId("sync-status-chip")).getByRole("button", {
        name: /^sincronizar$/i,
      }),
    );

    // One module error, two announcers — same string, never diverged.
    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(2);
    for (const alert of alerts) {
      expect(alert).toHaveTextContent("La red falló.");
    }
    expect(
      within(screen.getByTestId("phone")).getByRole("alert"),
    ).toHaveTextContent("La red falló.");
  });

  it("clears the shared error on every surface once a retry succeeds", async () => {
    const id = seedDirty();
    pushMock.mockRejectedValueOnce(new Error("La red falló."));
    pushMock.mockResolvedValue({
      ok: true,
      pushedIds: [id],
      message: "Se sincronizó 1 registro con Supabase.",
    });
    render(
      <>
        <SyncStatusChip />
        <PhoneSyncRow testId="phone" />
      </>,
    );

    fireEvent.click(
      within(screen.getByTestId("sync-status-chip")).getByRole("button", {
        name: /^sincronizar$/i,
      }),
    );
    expect(await screen.findAllByRole("alert")).toHaveLength(2);

    // Either surface can retry: the phone row clears the chip's alert too.
    fireEvent.click(
      within(screen.getByTestId("phone")).getByRole("button", {
        name: /reintentar/i,
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /reintentar/i }),
    ).not.toBeInTheDocument();
  });
});
