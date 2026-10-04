import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { usePadronStore } from "../stores/padronStore";
import { SyncStatusChip } from "./SyncStatusChip";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    configurable: true,
  });
}

beforeEach(() => {
  localStorage.clear();
  usePadronStore.getState().reset();
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
});

describe("SyncStatusChip", () => {
  it("reports safety on this device when online with nothing pending", () => {
    render(<SyncStatusChip />);
    expect(screen.getByTestId("sync-status-chip")).toHaveTextContent(
      "A salvo en este equipo",
    );
  });

  it("counts dirty rows as pending when online", () => {
    const { add } = usePadronStore.getState();
    add({ nombre: "Ana Torres", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Luis Paz", edadMeses: 30, nivelHemoglobina: 6.5 });
    render(<SyncStatusChip />);
    expect(screen.getByTestId("sync-status-chip")).toHaveTextContent(
      "2 por sincronizar",
    );
  });

  it("includes tombstones in the pending count", () => {
    const { add, remove } = usePadronStore.getState();
    add({ nombre: "Ana Torres", edadMeses: 24, nivelHemoglobina: 12.0 });
    remove(usePadronStore.getState().pacientes[0].id);
    render(<SyncStatusChip />);
    // Soft-deleted but still dirty: queued for push, never hidden here.
    expect(screen.getByTestId("sync-status-chip")).toHaveTextContent(
      "1 por sincronizar",
    );
  });

  it("names the offline state with the pending count", () => {
    setOnline(false);
    const { add } = usePadronStore.getState();
    add({ nombre: "Ana Torres", edadMeses: 24, nivelHemoglobina: 12.0 });
    render(<SyncStatusChip />);
    expect(screen.getByTestId("sync-status-chip")).toHaveTextContent(
      "Sin conexión · 1 pendientes",
    );
  });

  it("reacts to offline/online events without a reload", () => {
    render(<SyncStatusChip />);
    expect(screen.getByTestId("sync-status-chip")).toHaveTextContent(
      "A salvo en este equipo",
    );
    act(() => {
      setOnline(false);
      fireEvent(window, new Event("offline"));
    });
    expect(screen.getByTestId("sync-status-chip")).toHaveTextContent(
      /sin conexión/i,
    );
    act(() => {
      setOnline(true);
      fireEvent(window, new Event("online"));
    });
    expect(screen.getByTestId("sync-status-chip")).toHaveTextContent(
      "A salvo en este equipo",
    );
  });

  it("announces as a polite live region and stays read-only", () => {
    render(<SyncStatusChip />);
    const chip = screen.getByTestId("sync-status-chip");
    expect(chip.getAttribute("role")).toBe("status");
    expect(chip.querySelector("button")).toBeNull();
  });
});
