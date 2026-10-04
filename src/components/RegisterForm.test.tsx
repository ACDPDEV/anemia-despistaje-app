import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePadronStore } from "../stores/padronStore";
import { useRegisterDraftStore } from "../stores/registerDraftStore";
import { HB_CUTOFF_LABEL } from "../domain/anemia";
import { RegisterForm } from "./RegisterForm";

beforeEach(() => {
  localStorage.clear();
  usePadronStore.getState().reset();
  useRegisterDraftStore.getState().clearDraft();
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

  it("hints first-timers with calm one-line field help", () => {
    render(<RegisterForm />);
    expect(screen.getByText("6 a 59 meses")).toBeInTheDocument();
    expect(
      screen.getByText("Valor del hemoglobinómetro, ej. 11.5"),
    ).toBeInTheDocument();
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
    // Edad and Hb always carry their calm one-line hints.
    expect(edad).toHaveAttribute("aria-describedby", "edad-hint");
    expect(hb).not.toHaveAttribute("aria-invalid");
    expect(hb).toHaveAttribute("aria-describedby", "hb-hint");

    // Fixing nombre and breaking edad moves the flag, never doubling it.
    fillAndSubmit("Luis Paz", "5", "12.0");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    const edadDescribedBy = screen
      .getByLabelText(/edad/i)
      .getAttribute("aria-describedby")!;
    expect(edadDescribedBy).toContain("edad-hint");
    expect(edadDescribedBy).toContain("edad-error");
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
    const warning = screen.getByText(/posible duplicado/i);
    expect(warning).toBeInTheDocument();
    expect(warning.className).toMatch(/text-warning/);
    expect(warning.className).not.toMatch(/amber-700/);
    expect(usePadronStore.getState().pacientes).toHaveLength(2);
  });

  it("announces the registration confirmation as a status with a theme token", () => {
    render(<RegisterForm />);
    fillAndSubmit("Ana Torres", "24", "12.0");

    const confirmation = screen.getByRole("status");
    expect(confirmation).toHaveTextContent(/paciente registrado/i);
    // Theme token lives on the inner span: the region itself stays neutral.
    expect(confirmation.querySelector(".text-success")).not.toBeNull();
    expect(confirmation.innerHTML).not.toMatch(/green-700/);
  });

  it("announces the duplicate warning as a non-interrupting status", () => {
    usePadronStore
      .getState()
      .add({ nombre: "María López", edadMeses: 24, nivelHemoglobina: 12.0 });
    render(<RegisterForm />);
    fillAndSubmit("maria lopez", "24", "12.0");

    // Warning, not alert: a status never steals typing focus.
    const warning = screen.getByText(/posible duplicado/i);
    const liveRegion = warning.closest('[role="status"]')!;
    expect(liveRegion.getAttribute("role")).toBe("status");
    // Serialized announcer: success and warning share ONE status, ordered.
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(liveRegion.textContent!.indexOf("registrado")).toBeLessThan(
      liveRegion.textContent!.indexOf("duplicado"),
    );
    expect(warning.closest("span")!.className).toMatch(/text-warning/);
  });

  it("keeps the single-match sentence naming the existing patient", () => {
    usePadronStore
      .getState()
      .add({ nombre: "María López", edadMeses: 24, nivelHemoglobina: 12.0 });
    render(<RegisterForm />);
    fillAndSubmit("maria lopez", "24", "12.0");
    expect(screen.getByText(/posible duplicado/i)).toHaveTextContent(
      "Posible duplicado: ya existe un paciente llamado María López.",
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("names the count when several patients share the name", () => {
    const { add } = usePadronStore.getState();
    add({ nombre: "María López", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Maria Lopez", edadMeses: 30, nivelHemoglobina: 11.0 });
    render(<RegisterForm />);
    fillAndSubmit("maria lopez", "24", "12.0");
    const warning = screen.getByText(/posible duplicado/i);
    expect(warning).toHaveTextContent(
      "Posible duplicado: ya existen 2 pacientes con ese nombre. Revisa el padrón antes de registrar.",
    );
    // Still warning-only: nothing blocks the registration.
    expect(warning.closest('[role="status"]')).not.toBeNull();
    expect(usePadronStore.getState().pacientes).toHaveLength(3);
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

  it("keeps the Descartar button outside the warning live region", () => {
    usePadronStore
      .getState()
      .add({ nombre: "María López", edadMeses: 24, nivelHemoglobina: 12.0 });
    render(<RegisterForm />);
    fillAndSubmit("maria lopez", "24", "12.0");

    const warning = screen.getByText(/posible duplicado/i);
    const liveRegion = warning.closest('[role="status"]')!;
    expect(liveRegion.tagName).toBe("P");
    // No interactive content inside the live region.
    expect(liveRegion.querySelector("button")).toBeNull();
    const dismiss = screen.getByRole("button", { name: /descartar/i });
    expect(liveRegion.contains(dismiss)).toBe(false);
  });

  it("surfaces the Hb cutoffs from the shared clinical source", () => {
    render(<RegisterForm />);
    // Real values, never retyped: the hint quotes the domain label.
    expect(screen.getByTestId("hb-cutoffs")).toHaveTextContent(HB_CUTOFF_LABEL);
    expect(HB_CUTOFF_LABEL).toMatch(/11/);
  });

  it("caps the nombre input at 120 characters with a Spanish message", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/nombre/i)).toHaveAttribute(
      "maxlength",
      "120",
    );
    fillAndSubmit("A".repeat(121), "24", "12.0");
    expect(screen.getByRole("alert")).toHaveTextContent(/exceder 120/i);
    expect(usePadronStore.getState().pacientes).toHaveLength(0);
  });

  it("returns focus to Nombre after a successful register for the capture loop", async () => {
    render(<RegisterForm />);
    fillAndSubmit("Ana Torres", "24", "12.0");
    expect(screen.getByText(/paciente registrado/i)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(screen.getByLabelText(/nombre/i));
  });
});

describe("RegisterForm draft persistence (P2-1)", () => {
  function typeDraft(nombre: string, edad: string, hb: string) {
    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: nombre },
    });
    fireEvent.change(screen.getByLabelText(/edad/i), {
      target: { value: edad },
    });
    fireEvent.change(screen.getByLabelText(/hemoglobina/i), {
      target: { value: hb },
    });
  }

  it("keeps the draft across a tab switch (unmount/remount) without registering", () => {
    const { unmount } = render(<RegisterForm />);
    typeDraft("Ana Tor", "2", "11");
    // Switching to Padrón/Panel unmounts the form: the draft must survive.
    unmount();
    expect(usePadronStore.getState().pacientes).toHaveLength(0);
    render(<RegisterForm />);
    expect(screen.getByLabelText(/nombre/i)).toHaveValue("Ana Tor");
    expect(screen.getByLabelText(/edad/i)).toHaveValue("2");
    expect(screen.getByLabelText(/hemoglobina/i)).toHaveValue("11");
  });

  it("clears the draft after a successful register so it never replays", () => {
    render(<RegisterForm />);
    fillAndSubmit("Ana Torres", "24", "12.0");
    expect(usePadronStore.getState().pacientes).toHaveLength(1);
    expect(useRegisterDraftStore.getState()).toMatchObject({
      nombre: "",
      edad: "",
      hb: "",
    });
  });

  it("restores the draft after a reload from persisted storage", async () => {
    const { unmount } = render(<RegisterForm />);
    typeDraft("Ana Torres", "24", "12.0");
    unmount();
    const raw = localStorage.getItem("register-draft-storage");
    expect(raw).toContain("Ana Torres");
    // Fresh-process memory: wipe in-memory state, then restore the storage
    // snapshot (the wipe itself persists, so the snapshot goes back after).
    useRegisterDraftStore.setState({ nombre: "", edad: "", hb: "" });
    localStorage.setItem("register-draft-storage", raw!);
    await useRegisterDraftStore.persist.rehydrate();
    render(<RegisterForm />);
    expect(screen.getByLabelText(/nombre/i)).toHaveValue("Ana Torres");
    expect(screen.getByLabelText(/edad/i)).toHaveValue("24");
    expect(screen.getByLabelText(/hemoglobina/i)).toHaveValue("12.0");
  });
});
