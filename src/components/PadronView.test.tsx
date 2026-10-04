import { beforeEach, describe, expect, it } from "vitest";
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

describe("PadronView", () => {
  it("lists registered patients with their evaluator-assigned diagnosis", () => {
    seedTwo();
    render(<PadronView />);
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(screen.getByText("Luis Paz")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.getByText("Anemia Severa")).toBeInTheDocument();
  });

  it("shows an empty state when the padron has no records", () => {
    render(<PadronView />);
    expect(screen.getByText(/no hay pacientes registrados/i)).toBeInTheDocument();
  });

  it("edits hemoglobin and recomputes the diagnosis", () => {
    seedTwo();
    render(<PadronView />);
    const row = screen.getByText("Ana Torres").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: /editar/i }));
    const hbInput = within(row).getByLabelText(/hemoglobina/i);
    fireEvent.change(hbInput, { target: { value: "8.0" } });
    fireEvent.click(within(row).getByRole("button", { name: /guardar/i }));
    expect(usePadronStore.getState().pacientes[0].diagnostico).toBe("Anemia Moderada");
    expect(screen.getByText("Anemia Moderada")).toBeInTheDocument();
  });

  it("deletes a patient from the padron", () => {
    seedTwo();
    render(<PadronView />);
    const row = screen.getByText("Luis Paz").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: /eliminar/i }));
    const { pacientes } = usePadronStore.getState();
    expect(pacientes).toHaveLength(2);
    const tombstone = pacientes.find((p) => p.nombre === "Luis Paz")!;
    expect(tombstone.deletedAt).toEqual(expect.any(String));
    expect(tombstone.dirty).toBe(true);
    expect(screen.queryByText("Luis Paz")).not.toBeInTheDocument();
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
  });
});
