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
});
