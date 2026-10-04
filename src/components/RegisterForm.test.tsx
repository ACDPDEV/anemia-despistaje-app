import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePadronStore } from "../stores/padronStore";
import { RegisterForm } from "./RegisterForm";

beforeEach(() => {
  localStorage.clear();
  usePadronStore.getState().reset();
});

function fillAndSubmit(nombre: string, edad: string, hb: string) {
  fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: nombre } });
  fireEvent.change(screen.getByLabelText(/edad/i), { target: { value: edad } });
  fireEvent.change(screen.getByLabelText(/hemoglobina/i), { target: { value: hb } });
  fireEvent.click(screen.getByRole("button", { name: /registrar/i }));
}

describe("RegisterForm", () => {
  it("renders Spanish labels and registers a valid patient with evaluator diagnosis", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/edad/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hemoglobina/i)).toBeInTheDocument();

    fillAndSubmit("Ana Torres", "24", "12.0");

    const { pacientes } = usePadronStore.getState();
    expect(pacientes).toHaveLength(1);
    expect(pacientes[0].nombre).toBe("Ana Torres");
    expect(pacientes[0].diagnostico).toBe("Normal");
    expect(screen.getByText(/paciente registrado/i)).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
  });

  it("rejects invalid data with Spanish messages and registers nothing", () => {    render(<RegisterForm />);

    // Empty nombre
    fillAndSubmit("   ", "24", "12.0");
    expect(screen.getByRole("alert")).toHaveTextContent(/nombre/i);

    // Edad out of range
    fillAndSubmit("Luis Paz", "5", "12.0");
    expect(screen.getByRole("alert")).toHaveTextContent(/edad/i);

    // Non-positive hb
    fillAndSubmit("Luis Paz", "24", "0");
    expect(screen.getByRole("alert")).toHaveTextContent(/hemoglobina/i);

    expect(usePadronStore.getState().pacientes).toHaveLength(0);
  });

  it("flags only the offending field with a wired aria-describedby", () => {
    render(<RegisterForm />);
    fillAndSubmit("", "24", "12.0");

    const nombre = screen.getByLabelText(/nombre/i);
    const edad = screen.getByLabelText(/edad/i);
    const hb = screen.getByLabelText(/hemoglobina/i);

    // Only nombre is invalid and points at its own error id.
    expect(nombre).toHaveAttribute("aria-invalid", "true");
    expect(nombre).toHaveAttribute("aria-describedby", "nombre-error");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "nombre-error");
    expect(edad).not.toHaveAttribute("aria-invalid");
    expect(edad).not.toHaveAttribute("aria-describedby");
    expect(hb).not.toHaveAttribute("aria-invalid");
    expect(hb).not.toHaveAttribute("aria-describedby");

    // Fixing nombre and breaking edad moves the flag, never doubling it.
    fillAndSubmit("Luis Paz", "5", "12.0");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByLabelText(/edad/i)).toHaveAttribute(
      "aria-describedby",
      "edad-error",
    );
    expect(screen.getByLabelText(/nombre/i)).not.toHaveAttribute(
      "aria-invalid",
    );
  });

  it("keeps every field valid when the store cap rejects the submit", () => {
    const { add } = usePadronStore.getState();
    for (let i = 0; i < 100; i += 1) {
      add({ nombre: `Paciente ${i}`, edadMeses: 24, nivelHemoglobina: 12.0 });
    }
    render(<RegisterForm />);
    fillAndSubmit("Uno Más", "24", "12.0");

    expect(screen.getByRole("alert")).toHaveTextContent(/lleno/i);
    expect(screen.getByLabelText(/nombre/i)).not.toHaveAttribute(
      "aria-invalid",
    );
    expect(screen.getByLabelText(/edad/i)).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText(/hemoglobina/i)).not.toHaveAttribute(
      "aria-invalid",
    );
    expect(usePadronStore.getState().pacientes).toHaveLength(100);
  });

  it("warns about a possible duplicate yet still registers", () => {
    usePadronStore
      .getState()
      .add({ nombre: "María López", edadMeses: 24, nivelHemoglobina: 12.0 });
    render(<RegisterForm />);
    fillAndSubmit("maria lopez", "24", "12.0");
    expect(screen.getByText(/posible duplicado/i)).toBeInTheDocument();
    expect(usePadronStore.getState().pacientes).toHaveLength(2);
  });

  it("dismisses the duplicate hint without losing the registration", () => {
    usePadronStore
      .getState()
      .add({ nombre: "José", edadMeses: 24, nivelHemoglobina: 12.0 });
    render(<RegisterForm />);
    fillAndSubmit("Jose", "24", "12.0");
    expect(screen.getByText(/posible duplicado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /descartar/i }));
    expect(screen.queryByText(/posible duplicado/i)).not.toBeInTheDocument();
    expect(usePadronStore.getState().pacientes).toHaveLength(2);
  });
});
