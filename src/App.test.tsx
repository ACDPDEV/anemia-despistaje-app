import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePadronStore } from "./stores/padronStore";
import App from "./App";

beforeEach(() => {
  localStorage.clear();
  usePadronStore.getState().reset();
});

describe("App offline flow", () => {
  it("registers a patient and shows it in padron and statistics", () => {
    render(<App />);

    // Default view is the registration form
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Ana Torres" } });
    fireEvent.change(screen.getByLabelText(/edad/i), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText(/hemoglobina/i), { target: { value: "12.0" } });
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));
    expect(screen.getByText(/paciente registrado/i)).toBeInTheDocument();

    // Padron view lists the new patient
    fireEvent.click(screen.getByRole("button", { name: /padrón/i }));
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();

    // Statistics view reflects the registration
    fireEvent.click(screen.getByRole("button", { name: /estadísticas/i }));
    expect(screen.getByText(/total de pacientes/i)).toBeInTheDocument();
    expect(screen.getByText(/12\.00/)).toBeInTheDocument();
  });
});
