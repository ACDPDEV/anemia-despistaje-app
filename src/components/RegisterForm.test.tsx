import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { usePadronStore } from "../stores/padronStore";
import { useRegisterDraftStore } from "../stores/registerDraftStore";
import { resetSyncGuardForTests } from "../lib/syncGuard";
import { HB_CUTOFF_LABEL } from "../domain/anemia";
import { RegisterForm } from "./RegisterForm";

beforeEach(() => {
  localStorage.clear();
  usePadronStore.getState().reset();
  useRegisterDraftStore.getState().clearDraft();
  resetSyncGuardForTests();
});

function fillAndSubmit(nombre: string, edad: string, hb: string) {
  fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: nombre } });
  fireEvent.change(screen.getByLabelText(/edad/i), { target: { value: edad } });
  fireEvent.change(screen.getByLabelText(/hemoglobina/i), { target: { value: hb } });
  // Two submit affordances share this form (primary + phone bar): pin the
  // primary by testid so the helper never ambiguates.
  fireEvent.click(screen.getByTestId("register-submit"));
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

    // Empty Edad/Hb pass the native layer (no required attribute) and
    // reach the Spanish submit validation with the same clinical copy.
    fillAndSubmit("Luis Paz", "", "12.0");
    expect(screen.getByRole("alert")).toHaveTextContent(/edad/i);

    fillAndSubmit("Luis Paz", "24", "");
    expect(screen.getByRole("alert")).toHaveTextContent(/hemoglobina/i);

    expect(usePadronStore.getState().pacientes).toHaveLength(0);
  });

  it("answers out-of-range Edad/Hb with Spanish validation, never a native bubble", () => {
    // run-26 P2-1: the form is noValidate (native bubbles speak the
    // browser's locale), so out-of-range values reach the submit handler
    // and the FIRST explanation is the Spanish inline error. Native
    // min/max/step stay as advisory progressive enhancement only.
    const { container } = render(<RegisterForm />);
    expect(container.querySelector("form")).toHaveAttribute("novalidate");
    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: "Luis Paz" },
    });
    fireEvent.change(screen.getByLabelText(/edad/i), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText(/hemoglobina/i), {
      target: { value: "12.0" },
    });
    fireEvent.click(screen.getByTestId("register-submit"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "La edad debe estar entre 6 y 59 meses.",
    );
    expect(usePadronStore.getState().pacientes).toHaveLength(0);

    // Same Spanish-first ownership on the Hb floor: "0" parses to 0, which
    // truly violates the strict inequality, so "> 0" is the RIGHT
    // diagnosis here (contrast the comma case below, where it never is).
    fireEvent.change(screen.getByLabelText(/edad/i), {
      target: { value: "24" },
    });
    fireEvent.change(screen.getByLabelText(/hemoglobina/i), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByTestId("register-submit"));
    expect(screen.getByRole("alert")).toHaveTextContent(/mayor que 0/);
    expect(usePadronStore.getState().pacientes).toHaveLength(0);
  });

  it("accepts the Spanish comma: 11,5 registers as 11.5, never '> 0'", () => {
    // run-26 P1 regression test: run-25's type=number sanitized "11,5" to
    // "" before onChange fired, and submit misdiagnosed the correct Spanish
    // entry as "debe ser mayor que 0". Hb is type=text + parseHemoglobina,
    // so the comma normalizes to 11.5 and registers.
    render(<RegisterForm />);
    fillAndSubmit("Ana Torres", "24", "11,5");

    const { pacientes } = usePadronStore.getState();
    expect(pacientes).toHaveLength(1);
    expect(pacientes[0].nivelHemoglobina).toBe(11.5);
    expect(pacientes[0].diagnostico).toBe("Normal");
    expect(screen.getByText(/paciente registrado/i)).toBeInTheDocument();
    expect(screen.queryByText(/mayor que 0/)).not.toBeInTheDocument();
  });

  it("diagnoses non-numeric Hb as a format problem, never '> 0'", () => {
    // run-26 P1: "abc" is not a number at all — the error must name the
    // real problem (write a number like 11.5 or 11,5), not the inequality.
    render(<RegisterForm />);
    fillAndSubmit("Luis Paz", "24", "abc");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El nivel de hemoglobina debe ser un número como 11.5 o 11,5.",
    );
    expect(screen.queryByText(/mayor que 0/)).not.toBeInTheDocument();
    expect(usePadronStore.getState().pacientes).toHaveLength(0);
  });

  it("keeps Edad numeric with advisory bounds; Hb is text for the comma, keeping inputMode", () => {
    render(<RegisterForm />);
    // Edad: integers only, so type=number is comma-safe; min/max/step stay
    // advisory under noValidate (Spanish validation explains first).
    const edad = screen.getByLabelText(/edad/i);
    expect(edad).toHaveAttribute("type", "number");
    expect(edad).toHaveAttribute("min", "6");
    expect(edad).toHaveAttribute("max", "59");
    expect(edad).toHaveAttribute("step", "1");
    expect(edad).toHaveAttribute("inputmode", "numeric");
    // Hb: type=text so "11,5" reaches parseHemoglobina intact (type=number
    // would sanitize it to "" before onChange); inputMode keeps the decimal
    // keyboard. The hint names both separators explicitly.
    const hb = screen.getByLabelText(/hemoglobina/i);
    expect(hb).toHaveAttribute("type", "text");
    expect(hb).not.toHaveAttribute("min");
    expect(hb).toHaveAttribute("inputmode", "decimal");
    expect(screen.getByText(/usa punto o coma/i)).toBeInTheDocument();
  });

  it("renders fields with no unnamed group role", () => {
    // run-25 P3-3b: Field dropped role="group" (an unnamed group is worse
    // than no group); labels stay explicitly wired through htmlFor/id.
    const { container } = render(<RegisterForm />);
    expect(container.querySelectorAll('[role="group"]')).toHaveLength(0);
    expect(screen.getByLabelText(/edad/i)).toHaveAttribute("id", "edad");
  });

  it("hints first-timers with calm one-line field help", () => {
    render(<RegisterForm />);
    expect(screen.getByText("6 a 59 meses")).toBeInTheDocument();
    expect(
      screen.getByText("Valor del hemoglobinómetro, ej. 11.5"),
    ).toBeInTheDocument();
  });

  it("cues the capture-moment triage inside the help disclosure, not the hint", () => {
    // run-28 P2-1 (clarify, option a): the visible hb-hint holds 3 spans
    // (example, comma, cutoffs) with margin; the triage cue is discoverable
    // WITHOUT opening the disclosure via the always-visible summary line,
    // with the full sentence verbatim in the disclosure body.
    render(<RegisterForm />);
    const triage = screen.getByTestId("hb-triage");
    expect(triage).toHaveTextContent(
      "Moderada o Severa → seguimiento en el Panel",
    );
    // On demand: inside the disclosure body, outside the field hint.
    const help = screen.getByTestId("register-help");
    expect(help).toContainElement(triage);
    expect(triage.closest("[id='hb-hint']")).toBeNull();
    // Discoverable closed: the summary line names the cue (one line, no
    // extra hint span) so no tap is needed to learn it.
    const summary = help.querySelector("summary")!;
    expect(summary).toHaveTextContent(/moderada\/severa → panel/i);
    // Visible hint keeps margin: exactly 3 spans (example, comma, cutoffs).
    const hint = document.getElementById("hb-hint")!;
    expect(hint.querySelectorAll(":scope > span")).toHaveLength(3);
    expect(hint).not.toHaveTextContent(/seguimiento en el panel/i);
    expect(hint).not.toHaveTextContent(/moderada\/severa → panel/i);
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

    // Fixing nombre and emptying edad moves the flag, never doubling it.
    // (Empty passes the native layer — no required — so the Spanish
    // validation still owns this case; out-of-range numbers are blocked
    // natively before the handler runs, pinned above.)
    fillAndSubmit("Luis Paz", "", "12.0");
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
    const warning = within(screen.getByRole("status")).getByText(/posible duplicado/i);
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

  it("names the patient in the success receipt on a single line", () => {
    render(<RegisterForm />);
    fillAndSubmit("Ana Torres", "24", "12.0");

    const confirmation = screen.getByRole("status");
    expect(confirmation).toHaveTextContent(
      "Paciente registrado: Ana Torres — Normal",
    );
    // ONE line on phones: long names truncate instead of wrapping.
    const receipt = confirmation.querySelector(".text-success")!;
    expect(receipt.className).toMatch(/truncate/);
  });

  it("exposes the Alt+S shortcut on the submit button", () => {
    render(<RegisterForm />);
    const submit = screen.getByTestId("register-submit");
    expect(submit).toHaveAttribute("aria-keyshortcuts", "Alt+S");
    expect(submit).toHaveTextContent(/^registrar paciente$/i);
  });

  it("announces the duplicate warning as a non-interrupting status", () => {
    usePadronStore
      .getState()
      .add({ nombre: "María López", edadMeses: 24, nivelHemoglobina: 12.0 });
    render(<RegisterForm />);
    fillAndSubmit("maria lopez", "24", "12.0");

    // Warning, not alert: a status never steals typing focus.
    const warning = within(screen.getByRole("status")).getByText(/posible duplicado/i);
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
    expect(within(screen.getByRole("status")).getByText(/posible duplicado/i)).toHaveTextContent(
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
    const warning = within(screen.getByRole("status")).getByText(/posible duplicado/i);
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
    expect(within(screen.getByRole("status")).getByText(/posible duplicado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /descartar/i }));
    // The live-region warning is gone (the contextual help step keeps its
    // own "duplicado" line elsewhere, so the assertion scopes to status).
    expect(
      within(screen.getByRole("status")).queryByText(/posible duplicado/i),
    ).not.toBeInTheDocument();
    expect(usePadronStore.getState().pacientes).toHaveLength(2);
  });

  it("keeps the Descartar button outside the warning live region", () => {
    usePadronStore
      .getState()
      .add({ nombre: "María López", edadMeses: 24, nivelHemoglobina: 12.0 });
    render(<RegisterForm />);
    fillAndSubmit("maria lopez", "24", "12.0");

    const warning = within(screen.getByRole("status")).getByText(/posible duplicado/i);
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

  it("offers the same 4 help steps beside the Hb cutoffs, quietly", () => {
    render(<RegisterForm />);
    const help = screen.getByTestId("register-help");
    // Per-view stem (run-27 P3-2): Registro asks "¿Cómo registro?".
    expect(help).toHaveTextContent(/¿cómo registro\?/i);
    expect(help.className).toMatch(/text-muted-foreground/);
    expect(help.className).toMatch(/text-xs/);
    // SAME steps as the sidebar footer, verbatim.
    for (const step of [/registra/i, /duplicado/i, /sincroniza/i, /imprime/i]) {
      expect(help).toHaveTextContent(step);
    }
    expect(help).toHaveTextContent(/alt\+s/i);
    expect(help).toHaveTextContent(/alt\+g/i);
    // The triage cue: summary line (always visible, run-28 P2-1) plus the
    // full sentence verbatim in the body.
    expect(help).toHaveTextContent(/moderada o severa → seguimiento en el panel/i);
    expect(help.querySelector("summary")).toHaveTextContent(
      /moderada\/severa → panel/i,
    );
    // run-28 P2-2 (distill): the meta scoping line is gone; the shortcuts
    // line above already scopes via the differentiated stems.
    expect(help).not.toHaveTextContent(/cada vista explica lo suyo/i);
    // Outside the Hb hint wiring: the disclosure is its own stop, not
    // field-hint noise on every Hb focus.
    const hb = screen.getByLabelText(/hemoglobina/i);
    expect(hb.getAttribute("aria-describedby")).not.toMatch(/register-help/);
    expect(help).not.toHaveAttribute("id", "hb-hint");
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
    // type=number inputs report through jest-dom as numbers, never strings.
    expect(screen.getByLabelText(/edad/i)).toHaveValue(2);
    // Hb is type=text for the comma (run-26 P1): the draft string survives.
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
    expect(screen.getByLabelText(/edad/i)).toHaveValue(24);
    expect(screen.getByLabelText(/hemoglobina/i)).toHaveValue("12.0");
  });
});

describe("RegisterForm phone sync row (run-24 P2-1)", () => {
  function setOnline(value: boolean) {
    Object.defineProperty(window.navigator, "onLine", {
      value,
      configurable: true,
    });
  }

  function seedDirty() {
    const { add } = usePadronStore.getState();
    add({ nombre: "Ana Torres", edadMeses: 24, nivelHemoglobina: 12.0 });
  }

  it("renders the shared phone-only sync row with the pending vocabulary", () => {
    setOnline(true);
    seedDirty();
    render(<RegisterForm />);
    try {
      const row = screen.getByTestId("register-sync-phone");
      // Phone surface only (CSS contract, same pin grammar as Padrón):
      // off desktop, off paper.
      expect(row.className).toMatch(/sm:hidden/);
      expect(row.className).toMatch(/print:hidden/);
      // Same syncGuard strings as the chip, never a divergent phrasing.
      expect(row).toHaveTextContent("1 por sincronizar");
      const action = within(row).getByRole("button", {
        name: /^sincronizar$/i,
      });
      expect(action).toHaveAttribute("data-sync-action", "true");
      expect(action).toHaveAttribute("aria-keyshortcuts", "Alt+G");
      expect(action.getAttribute("title")).toContain("Alt+G");
    } finally {
      setOnline(true);
    }
  });

  it("stays quiet when clean and online: fresh app shows no row", () => {
    setOnline(true);
    // Fresh app: nothing registered, nothing pending, online.
    render(<RegisterForm />);
    expect(screen.queryByTestId("register-sync-phone")).not.toBeInTheDocument();
  });

  it("stays quiet when synced and online, like the Padrón row", () => {
    setOnline(true);
    seedDirty();
    const ids = usePadronStore.getState().pacientes.map((p) => p.id);
    usePadronStore.getState().markSynced(ids);
    render(<RegisterForm />);
    expect(screen.queryByTestId("register-sync-phone")).not.toBeInTheDocument();
  });

  it("names the offline state with no action, mirroring the chip", () => {
    setOnline(false);
    seedDirty();
    render(<RegisterForm />);
    try {
      const row = screen.getByTestId("register-sync-phone");
      expect(row).toHaveTextContent(/sin conexión/i);
      expect(row).toHaveTextContent("1 por sincronizar");
      expect(
        within(row).queryByRole("button", { name: /sincronizar/i }),
      ).not.toBeInTheDocument();
    } finally {
      setOnline(true);
    }
  });
});

describe("RegisterForm phone submit bar (run-29 P2-1)", () => {
  function fillValid() {
    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: "Ana Torres" },
    });
    fireEvent.change(screen.getByLabelText(/edad/i), {
      target: { value: "24" },
    });
    fireEvent.change(screen.getByLabelText(/hemoglobina/i), {
      target: { value: "12.0" },
    });
  }

  it("renders a phone-only sticky thumb-zone bar with a second submit", () => {
    render(<RegisterForm />);
    const bar = screen.getByTestId("register-submit-bar");
    // Phone surface only (same CSS contract as the phone sync row): off
    // desktop, off paper. sticky (not fixed) so it rides along only while
    // the form is on screen.
    expect(bar.className).toMatch(/sm:hidden/);
    expect(bar.className).toMatch(/print:hidden/);
    expect(bar.className).toMatch(/sticky/);
    // Quiet Card surface: top border separation, no shadow, no live region.
    expect(bar.className).toMatch(/border-t/);
    expect(bar.className).toMatch(/bg-card/);
    expect(within(bar).queryByRole("status")).not.toBeInTheDocument();
    expect(within(bar).queryByRole("alert")).not.toBeInTheDocument();
    const phone = screen.getByTestId("register-submit-phone");
    expect(phone).toHaveAttribute("type", "submit");
    expect(phone).toHaveTextContent(/^registrar$/i);
    expect(phone.className).toMatch(/min-h-11/);
    expect(phone.className).toMatch(/w-full/);
    // Same shortcut grammar as the primary (shared Alt+S mechanism).
    expect(phone).toHaveAttribute("aria-keyshortcuts", "Alt+S");
  });

  it("submits the form through the phone button with identical guards", () => {
    render(<RegisterForm />);
    fillValid();
    fireEvent.click(screen.getByTestId("register-submit-phone"));

    const { pacientes } = usePadronStore.getState();
    expect(pacientes).toHaveLength(1);
    expect(pacientes[0].nombre).toBe("Ana Torres");
    expect(screen.getByText(/paciente registrado/i)).toBeInTheDocument();
  });

  it("rejects invalid data through the phone button with Spanish messages", () => {
    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByLabelText(/edad/i), {
      target: { value: "24" },
    });
    fireEvent.change(screen.getByLabelText(/hemoglobina/i), {
      target: { value: "12.0" },
    });
    fireEvent.click(screen.getByTestId("register-submit-phone"));

    expect(screen.getByRole("alert")).toHaveTextContent(/nombre/i);
    expect(usePadronStore.getState().pacientes).toHaveLength(0);
  });

  it("keeps both submits inside the same form (one submit mechanism)", () => {
    render(<RegisterForm />);
    const form = document.getElementById("register-form")!;
    expect(form).toContainElement(screen.getByTestId("register-submit"));
    expect(form).toContainElement(
      screen.getByTestId("register-submit-phone"),
    );
  });
});
