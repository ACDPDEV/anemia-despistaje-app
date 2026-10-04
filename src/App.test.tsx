import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePadronStore } from "./stores/padronStore";
import App from "./App";

beforeEach(() => {
  localStorage.clear();
  usePadronStore.getState().reset();
});

describe("App offline flow", () => {
  it("registers a patient and shows it in padron and dashboard", () => {
    render(<App />);

    // Default view is the registration form
    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: "Ana Torres" },
    });
    fireEvent.change(screen.getByLabelText(/edad/i), {
      target: { value: "24" },
    });
    fireEvent.change(screen.getByLabelText(/hemoglobina/i), {
      target: { value: "12.0" },
    });
    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));
    expect(screen.getByText(/paciente registrado/i)).toBeInTheDocument();

    // Padron view lists the new patient in a table with a badge
    fireEvent.click(screen.getByRole("tab", { name: /padrón/i }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();

    // Dashboard view reflects the registration
    fireEvent.click(screen.getByRole("tab", { name: /dashboard/i }));
    expect(screen.getByTestId("kpi-total")).toHaveTextContent("1");
    expect(screen.getByText(/12\.00/)).toBeInTheDocument();
  });

  it("navigates back to registro from the empty padron call-to-action", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: /padrón/i }));
    fireEvent.click(screen.getByRole("button", { name: /registrar paciente/i }));
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
  });
});
