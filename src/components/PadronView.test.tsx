import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { usePadronStore } from "../stores/padronStore";
import { PadronView } from "./PadronView";

beforeEach(() => {
  localStorage.clear();
  usePadronStore.getState().reset();
});

function seedTwo() {
  const { add } = usePadronStore.getState();
  add({ nombre: "Ana Torres", edadMeses: 24, nivelHemoglobina: 12.0 });
  add({ nombre: "Luis Paz", edadMeses: 30, nivelHemoglobina: 6.5 });
}

function rowByName(name: string): HTMLElement {
  return screen.getByText(name).closest("tr")!;
}

function seedTriage() {
  const { add } = usePadronStore.getState();
  add({ nombre: "Nora Normal", edadMeses: 24, nivelHemoglobina: 12.0 });
  add({ nombre: "Severo Soto", edadMeses: 30, nivelHemoglobina: 6.5 });
  add({ nombre: "Leve Lara", edadMeses: 28, nivelHemoglobina: 10.5 });
}

function visibleNames(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent ?? "");
}

describe("PadronView", () => {
  it("renders patients in a table with a badge per diagnosis", () => {
    seedTwo();
    render(<PadronView />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    const anaRow = rowByName("Ana Torres");
    const luisRow = rowByName("Luis Paz");
    expect(within(anaRow).getByText("Normal")).toBeInTheDocument();
    expect(within(luisRow).getByText("Anemia Severa")).toBeInTheDocument();
  });

  it("narrows rows as the user types a name fragment", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "ana" },
    });
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(screen.queryByText("Luis Paz")).not.toBeInTheDocument();
  });

  it("matches names case-insensitively", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "ANA" },
    });
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(screen.queryByText("Luis Paz")).not.toBeInTheDocument();
  });

  it("shows Sin resultados when the filter matches no patient", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "zzz" },
    });
    expect(screen.getByText(/sin resultados/i)).toBeInTheDocument();
    expect(screen.queryByText("Ana Torres")).not.toBeInTheDocument();
  });

  it("shows an empty state with a register call-to-action when the padron has no records", () => {
    const onEmptyRegister = vi.fn();
    render(<PadronView onEmptyRegister={onEmptyRegister} />);
    expect(screen.getByText(/no hay pacientes registrados/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));
    expect(onEmptyRegister).toHaveBeenCalledTimes(1);
  });

  it("edits hemoglobin and recomputes the diagnosis", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Ana Torres");
    fireEvent.click(within(row).getByRole("button", { name: /editar/i }));
    const hbInput = screen.getByLabelText(/hemoglobina/i);
    fireEvent.change(hbInput, { target: { value: "8.0" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    expect(usePadronStore.getState().pacientes[0].diagnostico).toBe(
      "Anemia Moderada",
    );
    expect(
      within(rowByName("Ana Torres")).getByText("Anemia Moderada"),
    ).toBeInTheDocument();
  });

  it("deletes a patient from the padron", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Luis Paz");
    fireEvent.click(within(row).getByRole("button", { name: /eliminar/i }));
    expect(usePadronStore.getState().pacientes).toHaveLength(1);
    expect(screen.queryByText("Luis Paz")).not.toBeInTheDocument();
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
  });

  it("lists patients in registration order while graves-first is off", () => {
    seedTriage();
    render(<PadronView />);
    expect(screen.getByRole("checkbox", { name: /graves primero/i })).not.toBeChecked();
    expect(visibleNames()).toEqual(["Nora Normal", "Severo Soto", "Leve Lara"]);
  });

  it("sorts Severa first when graves-first is on and restores order when off", () => {
    seedTriage();
    render(<PadronView />);
    const toggle = screen.getByRole("checkbox", { name: /graves primero/i });
    fireEvent.click(toggle);
    expect(visibleNames()).toEqual(["Severo Soto", "Leve Lara", "Nora Normal"]);
    fireEvent.click(toggle);
    expect(visibleNames()).toEqual(["Nora Normal", "Severo Soto", "Leve Lara"]);
  });

  it("shows the Moderada + Severa alert count", () => {
    seedTriage();
    render(<PadronView />);
    expect(screen.getByText(/moderada \+ severa: 1/i)).toBeInTheDocument();
  });

  it("badges every row that shares a normalized name", () => {
    const { add } = usePadronStore.getState();
    add({ nombre: "Luis Pérez", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Luis Perez", edadMeses: 30, nivelHemoglobina: 12.0 });
    render(<PadronView />);
    expect(screen.getAllByText(/posible duplicado/i)).toHaveLength(2);
  });

  it("matches accented names from an unaccented filter", () => {
    const { add } = usePadronStore.getState();
    add({ nombre: "José", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Ana Torres", edadMeses: 24, nivelHemoglobina: 12.0 });
    render(<PadronView />);
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "Jose" },
    });
    expect(screen.getByText("José")).toBeInTheDocument();
    expect(screen.queryByText("Ana Torres")).not.toBeInTheDocument();
  });
});
