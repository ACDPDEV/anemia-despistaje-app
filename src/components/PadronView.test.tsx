import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { usePadronStore } from "../stores/padronStore";
import { recordPull, resetSyncGuardForTests } from "../lib/syncGuard";
import { resetSupabaseClientForTests } from "../lib/supabase";
import { SyncStatusChip } from "./SyncStatusChip";
import { PadronView } from "./PadronView";

beforeEach(() => {
  localStorage.clear();
  usePadronStore.getState().reset();
  // Module-owned sync error: never leak an alert line across tests.
  resetSyncGuardForTests();
});

function seedTwo() {
  const { add } = usePadronStore.getState();
  add({ nombre: "Ana Torres", edadMeses: 24, nivelHemoglobina: 12.0 });
  add({ nombre: "Luis Paz", edadMeses: 30, nivelHemoglobina: 6.5 });
}

function rowByName(name: string): HTMLElement {
  return screen.getByText(name).closest("tr")!;
}

// Two select-all controls share one accessible name and one scope
// (selected ∩ visible): the sr-only header checkbox inside the table and
// the mobile-only line above it (the thead hides below sm). Same handler,
// so behavior tests pin the header one and parity tests pin the mobile one.
function selectAllBoxes(): { header: HTMLElement; mobile: HTMLElement } {
  const table = screen.getByRole("table");
  const boxes = screen.getAllByRole("checkbox", {
    name: /pacientes visibles/i,
  });
  const header = boxes.find((b) => table.contains(b))!;
  const mobile = boxes.find((b) => !table.contains(b))!;
  expect(header).toBeDefined();
  expect(mobile).toBeDefined();
  return { header, mobile };
}

function seedTriage() {
  const { add } = usePadronStore.getState();
  add({ nombre: "Nora Normal", edadMeses: 24, nivelHemoglobina: 12.0 });
  add({ nombre: "Severo Soto", edadMeses: 30, nivelHemoglobina: 6.5 });
  add({ nombre: "Leve Lara", edadMeses: 28, nivelHemoglobina: 10.5 });
}

function visibleNames(): string[] {
  // Cell 0 is the bulk-selection checkbox; nombre moved to cell 1.
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[1].textContent ?? "");
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

  it("deletes a patient from the padron after confirmation", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Luis Paz");
    fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
    fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
    const { pacientes } = usePadronStore.getState();
    expect(pacientes).toHaveLength(2);
    const tombstone = pacientes.find((p) => p.nombre === "Luis Paz")!;
    expect(tombstone.deletedAt).toEqual(expect.any(String));
    expect(tombstone.dirty).toBe(true);
    expect(screen.queryByText("Luis Paz")).not.toBeInTheDocument();
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
  });

  it("does not delete on the first tap: confirmation is required", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Luis Paz");
    fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
    // First tap only arms the guard: row stays, no tombstone, undo hidden.
    expect(screen.getByText("Luis Paz")).toBeInTheDocument();
    expect(
      usePadronStore.getState().pacientes.find((p) => p.nombre === "Luis Paz")!
        .deletedAt,
    ).toBeNull();
    expect(screen.queryByText(/paciente eliminado/i)).not.toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: /confirmar/i }),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: /cancelar/i }),
    ).toBeInTheDocument();
    // Second tap confirms the delete.
    fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
    expect(screen.queryByText("Luis Paz")).not.toBeInTheDocument();
    expect(
      usePadronStore.getState().pacientes.find((p) => p.nombre === "Luis Paz")!
        .deletedAt,
    ).toEqual(expect.any(String));
  });

  it("restores the patient when Deshacer is pressed in the undo toast", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Luis Paz");
    fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
    fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
    expect(screen.queryByText("Luis Paz")).not.toBeInTheDocument();
    expect(screen.getByText(/paciente eliminado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /deshacer/i }));
    // Tombstone cleared and the row is visible again.
    const restored = usePadronStore
      .getState()
      .pacientes.find((p) => p.nombre === "Luis Paz")!;
    expect(restored.deletedAt).toBeNull();
    expect(screen.getByText("Luis Paz")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /deshacer/i })).not.toBeInTheDocument();
  });

  it("reverts without deleting when Cancelar is pressed", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Luis Paz");
    fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
    fireEvent.click(within(row).getByRole("button", { name: /cancelar/i }));
    expect(screen.getByText("Luis Paz")).toBeInTheDocument();
    expect(
      usePadronStore.getState().pacientes.find((p) => p.nombre === "Luis Paz")!
        .deletedAt,
    ).toBeNull();
    expect(
      within(rowByName("Luis Paz")).getByRole("button", { name: /^eliminar$/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/paciente eliminado/i)).not.toBeInTheDocument();
  });

  it("reverts without deleting on Escape", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Luis Paz");
    fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
    const confirm = within(row).getByRole("button", { name: /confirmar/i });
    fireEvent.keyDown(confirm, { key: "Escape" });
    expect(screen.getByText("Luis Paz")).toBeInTheDocument();
    expect(
      usePadronStore.getState().pacientes.find((p) => p.nombre === "Luis Paz")!
        .deletedAt,
    ).toBeNull();
    expect(
      within(rowByName("Luis Paz")).getByRole("button", { name: /^eliminar$/i }),
    ).toBeInTheDocument();
  });

  it("renders the severity-first toggle as a design-system checkbox with label association", () => {
    seedTwo();
    render(<PadronView />);
    const toggle = screen.getByRole("checkbox", { name: /casos más graves primero/i });
    // Native input restyled with theme tokens, not a raw checkbox.
    expect(toggle).toHaveAttribute("data-slot", "checkbox");
    expect(toggle.tagName).toBe("INPUT");
    // Label association survives the swap.
    expect(screen.getByLabelText(/casos más graves primero/i)).toBe(toggle);
    // 44px touch hit area comes from the label row on coarse pointers.
    expect(toggle.closest("label")?.className).toMatch(/pointer-coarse:min-h-11/);
  });

  it("gives every row action button a coarse-pointer minimum height", () => {
    seedTwo();
    render(<PadronView />);
    const anaRow = rowByName("Ana Torres");
    for (const name of [/editar/i, /^eliminar$/i]) {
      expect(
        within(anaRow).getByRole("button", { name }).className,
      ).toMatch(/pointer-coarse:min-h-11/);
    }
    // Armed confirm pair.
    fireEvent.click(within(anaRow).getByRole("button", { name: /^eliminar$/i }));
    for (const name of [/confirmar/i, /cancelar/i]) {
      expect(
        within(anaRow).getByRole("button", { name }).className,
      ).toMatch(/pointer-coarse:min-h-11/);
    }
    // Edit-row pair lives in its own form: disarm the confirm first so the
    // Cancelar query is unambiguous.
    fireEvent.click(within(anaRow).getByRole("button", { name: /cancelar/i }));
    const luisRow = rowByName("Luis Paz");
    fireEvent.click(within(luisRow).getByRole("button", { name: /editar/i }));
    const form = screen.getByRole("button", { name: /guardar/i }).closest("form")!;
    for (const name of [/guardar/i, /cancelar/i]) {
      expect(within(form).getByRole("button", { name }).className).toMatch(
        /pointer-coarse:min-h-11/,
      );
    }
  });

  it("lists patients in registration order while severity-first is off", () => {
    seedTriage();
    render(<PadronView />);
    expect(screen.getByRole("checkbox", { name: /casos más graves primero/i })).not.toBeChecked();
    expect(visibleNames()).toEqual(["Nora Normal", "Severo Soto", "Leve Lara"]);
  });

  it("sorts Severa first when severity-first is on and restores order when off", () => {
    seedTriage();
    render(<PadronView />);
    const toggle = screen.getByRole("checkbox", { name: /casos más graves primero/i });
    fireEvent.click(toggle);
    expect(visibleNames()).toEqual(["Severo Soto", "Leve Lara", "Nora Normal"]);
    fireEvent.click(toggle);
    expect(visibleNames()).toEqual(["Nora Normal", "Severo Soto", "Leve Lara"]);
  });

  it("shows the Moderada + Severa alert count", () => {
    seedTriage();
    render(<PadronView />);
    expect(screen.getByRole("status")).toHaveTextContent(
      /moderada \+ severa \(en vista\): 1 de 3/i,
    );
  });

  it("derives the status line from the visible rows when a filter is active", () => {
    seedTriage();
    render(<PadronView />);
    // Nora Normal is the only visible row and needs no follow-up.
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "nora" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      /moderada \+ severa \(en vista\): 0 de 1/i,
    );
    // Severo Soto alone is a 1-of-1 triage view, not the global 1-of-3.
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "severo" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      /moderada \+ severa \(en vista\): 1 de 1/i,
    );
  });

  it("badges every row that shares a normalized name", () => {
    const { add } = usePadronStore.getState();
    add({ nombre: "Luis Pérez", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Luis Perez", edadMeses: 30, nivelHemoglobina: 12.0 });
    render(<PadronView />);
    expect(screen.getAllByText(/posible duplicado/i)).toHaveLength(2);
  });

  it("flags only the offending edit-row field with a wired describedby", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Ana Torres");
    fireEvent.click(within(row).getByRole("button", { name: /editar/i }));

    // Break only edad with an empty value: empties pass the native layer
    // (no required) and reach the Spanish validation. Out-of-range numbers
    // are blocked natively before the handler runs (pinned below); the
    // wiring asserted here is identical either way.
    fireEvent.change(screen.getByLabelText(/edad/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    const edad = screen.getByLabelText(/edad/i);
    const nombre = screen.getByLabelText(/^nombre/i);
    const hb = screen.getByLabelText(/hemoglobina/i);
    expect(edad).toHaveAttribute("aria-invalid", "true");
    const describedBy = edad.getAttribute("aria-describedby")!;
    expect(describedBy).toMatch(/edad-.*-hint/);
    expect(describedBy).toMatch(/edad-.*-error/);
    expect(document.getElementById(describedBy.split(" ").at(-1)!)).toHaveTextContent(
      "La edad debe estar entre 6 y 59 meses.",
    );
    expect(nombre).not.toHaveAttribute("aria-invalid");
    expect(nombre).not.toHaveAttribute("aria-describedby");
    expect(hb).not.toHaveAttribute("aria-invalid");
    // Hb mirrors the create form: the calm hint stays wired while valid.
    expect(hb.getAttribute("aria-describedby")).toMatch(/hb-.*-hint/);
    // No edit happens while invalid.
    expect(usePadronStore.getState().pacientes[0].edadMeses).toBe(24);
  });

  it("mirrors the create-form Edad/Hb hints in the edit row", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Ana Torres");
    fireEvent.click(within(row).getByRole("button", { name: /editar/i }));
    expect(screen.getByText("6 a 59 meses")).toBeInTheDocument();
    expect(
      screen.getByText("Valor del hemoglobinómetro, ej. 11.5"),
    ).toBeInTheDocument();
  });

  it("builds the nombre filter on the Field system", () => {
    seedTwo();
    render(<PadronView />);
    const input = screen.getByLabelText(/buscar por nombre/i);
    const field = input.closest("[data-slot='field']");
    expect(field).not.toBeNull();
    expect(
      field!.querySelector("[data-slot='field-label']"),
    ).not.toBeNull();
  });

  it("shows Limpiar only with a non-empty filter and clears on click", () => {
    seedTwo();
    render(<PadronView />);
    expect(
      screen.queryByRole("button", { name: /limpiar/i }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "ana" },
    });
    expect(screen.queryByText("Luis Paz")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /limpiar/i }));
    expect(screen.getByText("Luis Paz")).toBeInTheDocument();
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /limpiar/i }),
    ).not.toBeInTheDocument();
  });

  it("clears the filter on Escape while the filter input is focused", () => {
    seedTwo();
    render(<PadronView />);
    const input = screen.getByLabelText(/buscar/i);
    fireEvent.change(input, { target: { value: "ana" } });
    expect(screen.queryByText("Luis Paz")).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getByText("Luis Paz")).toBeInTheDocument();
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
  });

  it("closes a clean edit on Escape silently and returns focus to Editar", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Ana Torres");
    fireEvent.click(within(row).getByRole("button", { name: /editar/i }));
    const nombreInput = screen.getByLabelText(/^nombre/i);
    // No changes: clean, so Esc closes silently with no discard prompt.
    fireEvent.keyDown(nombreInput, { key: "Escape" });
    expect(
      screen.queryByRole("button", { name: /guardar/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /descartar cambios/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(usePadronStore.getState().pacientes[0].nombre).toBe("Ana Torres");
    expect(document.activeElement).toBe(
      within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
    );
  });

  it("arms a discard confirm on dirty Escape and discards on the second Escape", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Ana Torres");
    fireEvent.click(within(row).getByRole("button", { name: /editar/i }));
    const nombreInput = screen.getByLabelText(/^nombre/i);
    fireEvent.change(nombreInput, { target: { value: "Cambiado" } });
    // First Esc arms the in-row confirm: the draft stays open.
    fireEvent.keyDown(nombreInput, { key: "Escape" });
    expect(
      screen.getByRole("button", { name: /descartar cambios/i }),
    ).toBeInTheDocument();
    // Armed row is binary: Guardar steps aside, inputs lock.
    expect(
      screen.queryByRole("button", { name: /guardar/i }),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /descartar cambios/i }),
    );
    // Second Esc confirms the discard: edit closed, nothing saved, focus
    // back on the originating Editar.
    fireEvent.keyDown(
      screen.getByRole("button", { name: /descartar cambios/i }),
      { key: "Escape" },
    );
    expect(
      screen.queryByRole("button", { name: /guardar/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(usePadronStore.getState().pacientes[0].nombre).toBe("Ana Torres");
    expect(document.activeElement).toBe(
      within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
    );
  });

  it("saves the row edit on form submit (Enter)", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Ana Torres");
    fireEvent.click(within(row).getByRole("button", { name: /editar/i }));
    const hbInput = screen.getByLabelText(/hemoglobina/i);
    fireEvent.change(hbInput, { target: { value: "8.0" } });
    // Enter in a single-line input submits the row form.
    fireEvent.submit(hbInput.closest("form")!);
    expect(usePadronStore.getState().pacientes[0].diagnostico).toBe(
      "Anemia Moderada",
    );
    expect(
      within(rowByName("Ana Torres")).getByText("Anemia Moderada"),
    ).toBeInTheDocument();
  });

  it("keeps the empty state quiet: one sentence, CTA, no dead actions", () => {
    render(<PadronView />);
    expect(
      screen.getByText(/no hay pacientes registrados/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/disponibles con pacientes registrados/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /exportar csv/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /imprimir/i }),
    ).not.toBeInTheDocument();
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

  it("renders a visually-hidden caption naming the table with the visible count", () => {
    seedTwo();
    const { container } = render(<PadronView />);
    const caption = container.querySelector("caption");
    expect(caption).not.toBeNull();
    expect(caption).toHaveTextContent("Padrón de pacientes — 2 en vista");
    expect(caption!.className).toMatch(/sr-only/);
  });

  it("derives the caption count from the visible rows when a filter is active", () => {
    seedTwo();
    const { container } = render(<PadronView />);
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "ana" },
    });
    expect(container.querySelector("caption")).toHaveTextContent(
      "Padrón de pacientes — 1 en vista",
    );
  });

  it("labels every selection checkbox and keeps a coarse-pointer hit area", () => {
    seedTwo();
    render(<PadronView />);
    const headerToggle = selectAllBoxes().header;
    expect(headerToggle.tagName).toBe("INPUT");
    expect(headerToggle.closest("label")?.className).toMatch(
      /pointer-coarse:min-h-11/,
    );
    const rowToggle = screen.getByRole("checkbox", {
      name: /seleccionar a ana torres/i,
    });
    expect(rowToggle).not.toBeChecked();
    expect(rowToggle.closest("label")?.className).toMatch(
      /pointer-coarse:min-h-11/,
    );
  });

  it("selects only the visible (filtered) set with select-all", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "ana" },
    });
    fireEvent.click(
      selectAllBoxes().header,
    );
    expect(screen.getByText("1 seleccionado en vista")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /seleccionar a ana torres/i }),
    ).toBeChecked();
    // Luis Paz is filtered out: not selected, no row, no checkbox.
    expect(
      screen.queryByRole("checkbox", { name: /seleccionar a luis paz/i }),
    ).not.toBeInTheDocument();
  });

  it("preserves the selection when the filter changes", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /seleccionar a ana torres/i }),
    );
    expect(screen.getByText("1 seleccionado en vista")).toBeInTheDocument();
    // Narrowing to Luis hides Ana but keeps her selection: the bulk bar
    // scopes to the visible set, so with nothing visible it stands down.
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "luis" },
    });
    expect(screen.queryByText("Ana Torres")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /eliminar seleccionados/i }),
    ).not.toBeInTheDocument();
    // Back to the full view: Ana is still selected, count live.
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "" },
    });
    expect(screen.getByText("1 seleccionado en vista")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /seleccionar a ana torres/i }),
    ).toBeChecked();
  });

  it("scopes bulk delete to selected ∩ visible, leaving hidden selections intact", () => {
    seedTwo();
    render(<PadronView />);
    // Select both rows, then narrow to Ana: the bar counts 1 in vista.
    fireEvent.click(
      selectAllBoxes().header,
    );
    expect(screen.getByText("2 seleccionados en vista")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "ana" },
    });
    expect(screen.getByText("1 seleccionado en vista")).toBeInTheDocument();
    // Confirm the bulk delete: only the visible Ana is tombstoned.
    fireEvent.click(
      screen.getByRole("button", { name: /eliminar seleccionados/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /confirmar eliminación/i }),
    );
    expect(screen.getByText(/paciente eliminado/i)).toBeInTheDocument();
    // Clearing the filter reveals Luis alive AND still selected.
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "" },
    });
    expect(screen.getByText("Luis Paz")).toBeInTheDocument();
    expect(screen.getByText("1 seleccionado en vista")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /seleccionar a luis paz/i }),
    ).toBeChecked();
  });

  it("merges select-all into hidden selections instead of replacing them", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /seleccionar a ana torres/i }),
    );
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "luis" },
    });
    // Select-all covers the visible Luis only; Ana's hidden selection stays.
    fireEvent.click(
      selectAllBoxes().header,
    );
    expect(screen.getByText("1 seleccionado en vista")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "" },
    });
    expect(screen.getByText("2 seleccionados en vista")).toBeInTheDocument();
  });

  it("extends the undo window on toast interaction instead of expiring", () => {
    vi.useFakeTimers();
    try {
      seedTwo();
      render(<PadronView />);
      const row = rowByName("Luis Paz");
      fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
      fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
      expect(screen.getByTestId("undo-toast")).toBeInTheDocument();
      // 7s pass, then activity inside a toast row restarts the 8s window
      // (the capture handlers live on the row, so the event must target
      // a descendant, as a real pointer would).
      act(() => {
        vi.advanceTimersByTime(7000);
      });
      fireEvent.pointerOver(
        screen.getByRole("button", { name: /deshacer/i }),
      );
      act(() => {
        vi.advanceTimersByTime(7000);
      });
      // 14s total, but the window slid: the toast stands.
      expect(screen.getByTestId("undo-toast")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /deshacer/i }),
      ).toBeInTheDocument();
      // Without further interaction the window expires for real.
      act(() => {
        vi.advanceTimersByTime(8000);
      });
      expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("dismisses the toast without restoring through Cerrar aviso", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Luis Paz");
    fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
    fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
    expect(screen.getByText(/paciente eliminado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cerrar aviso/i }));
    // Notice gone, tombstone stays: no restore, row stays deleted.
    expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
    expect(screen.queryByText("Luis Paz")).not.toBeInTheDocument();
    expect(
      usePadronStore.getState().pacientes.find((p) => p.nombre === "Luis Paz")!
        .deletedAt,
    ).toEqual(expect.any(String));
  });

  it("anchors the undo toast full-width on small screens", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Luis Paz");
    fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
    fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
    const toast = screen.getByTestId("undo-toast");
    expect(toast.className).toMatch(/max-sm:left-4/);
    expect(toast.className).toMatch(/max-sm:right-4/);
    expect(toast.className).toMatch(/max-sm:max-w-none/);
  });

  it("docks the undo toast bottom-left on desktop so it clears the right-side row actions", () => {
    seedTwo();
    const { container } = render(<PadronView />);
    // The action column is the LAST table column (right side): a
    // right-docked toast would cover row actions on sm+, so the toast
    // docks left on desktop.
    const heads = [...container.querySelectorAll("thead tr th")];
    expect(heads.length).toBeGreaterThan(0);
    expect(heads[heads.length - 1].className).toMatch(/padron-action-col/);
    const row = rowByName("Luis Paz");
    fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
    fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
    const toast = screen.getByTestId("undo-toast");
    expect(toast.className).toMatch(/sm:left-4/);
    expect(toast.className).toMatch(/sm:right-auto/);
    // Phone sheet intact: full-width bottom sheet below sm.
    expect(toast.className).toMatch(/max-sm:left-4/);
    expect(toast.className).toMatch(/max-sm:right-4/);
    expect(toast.className).toMatch(/max-sm:max-w-none/);
  });

  it("reports the select-all mixed state through indeterminate", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /seleccionar a ana torres/i }),
    );
    const header = selectAllBoxes().header as HTMLInputElement;
    expect(header.indeterminate).toBe(true);
    expect(header.checked).toBe(false);
    fireEvent.click(header);
    expect(
      (selectAllBoxes().header as HTMLInputElement).indeterminate,
    ).toBe(false);
    expect(screen.getByText("2 seleccionados en vista")).toBeInTheDocument();
  });

  it("deletes the selected rows after a single confirm and restores all with one undo", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      selectAllBoxes().header,
    );
    expect(screen.getByText("2 seleccionados en vista")).toBeInTheDocument();
    // First tap only arms the batch guard: nothing deleted yet.
    fireEvent.click(
      screen.getByRole("button", { name: /eliminar seleccionados/i }),
    );
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(screen.queryByText(/pacientes eliminados/i)).not.toBeInTheDocument();
    // Single confirm deletes both rows at once.
    fireEvent.click(
      screen.getByRole("button", { name: /confirmar eliminación/i }),
    );
    expect(screen.queryByText("Ana Torres")).not.toBeInTheDocument();
    expect(screen.queryByText("Luis Paz")).not.toBeInTheDocument();
    const { pacientes } = usePadronStore.getState();
    expect(pacientes.filter((p) => !p.deletedAt)).toHaveLength(0);
    expect(pacientes.filter((p) => p.deletedAt)).toHaveLength(2);
    // One toast for the batch, not two.
    expect(screen.getByText("2 pacientes eliminados.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /deshacer/i }));
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(screen.getByText("Luis Paz")).toBeInTheDocument();
    expect(
      usePadronStore.getState().pacientes.filter((p) => !p.deletedAt),
    ).toHaveLength(2);
  });

  it("reverts the batch delete without deleting on Cancelar", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /seleccionar a ana torres/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /eliminar seleccionados/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(screen.getByText("Luis Paz")).toBeInTheDocument();
    expect(
      usePadronStore.getState().pacientes.filter((p) => !p.deletedAt),
    ).toHaveLength(2);
    expect(screen.queryByText(/pacientes eliminados/i)).not.toBeInTheDocument();
  });

  it("rejects an overlong nombre in the edit row with the store message", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Ana Torres");
    fireEvent.click(within(row).getByRole("button", { name: /editar/i }));
    const nombreInput = screen.getByLabelText(/^nombre/i);
    expect(nombreInput).toHaveAttribute("maxlength", "120");
    fireEvent.change(nombreInput, { target: { value: "A".repeat(121) } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/exceder 120/i);
    expect(usePadronStore.getState().pacientes[0].nombre).toBe("Ana Torres");
  });

  it("names the severity-first toggle in plain language, not badge taxonomy", () => {
    seedTwo();
    render(<PadronView />);
    expect(
      screen.getByRole("checkbox", { name: /ver los casos más graves primero/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Ver Anemia Moderada y Severa primero"),
    ).not.toBeInTheDocument();
  });

  it("focuses Confirmar when a single delete is armed so Enter completes it", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Luis Paz");
    fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
    const confirm = within(rowByName("Luis Paz")).getByRole("button", {
      name: /confirmar/i,
    });
    expect(document.activeElement).toBe(confirm);
  });

  it("focuses Confirmar when a bulk delete is armed", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /seleccionar a ana torres/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /eliminar seleccionados/i }),
    );
    const confirm = screen.getByRole("button", {
      name: /confirmar eliminación/i,
    });
    expect(document.activeElement).toBe(confirm);
  });

  it("keeps two delete groups restorable, each with its own Deshacer", () => {
    seedTwo();
    render(<PadronView />);
    for (const name of ["Ana Torres", "Luis Paz"]) {
      const row = rowByName(name);
      fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
      fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
    }
    // Both nets survive: two compact rows, newest first.
    expect(screen.getAllByRole("button", { name: /deshacer/i })).toHaveLength(2);
    // Newest group (Luis Paz) restores first; Ana stays deleted.
    const undoButtons = screen.getAllByRole("button", { name: /deshacer/i });
    fireEvent.click(undoButtons[0]);
    expect(screen.getByText("Luis Paz")).toBeInTheDocument();
    expect(screen.queryByText("Ana Torres")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /deshacer/i })).toHaveLength(1);
    // The older group still restores on demand.
    fireEvent.click(screen.getByRole("button", { name: /deshacer/i }));
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /deshacer/i }),
    ).not.toBeInTheDocument();
  });

  it("evicts the oldest undo at capacity 3 with an honest announcement", () => {
    const { add } = usePadronStore.getState();
    add({ nombre: "Uno", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Dos", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Tres", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Cuatro", edadMeses: 24, nivelHemoglobina: 12.0 });
    render(<PadronView />);
    for (const name of ["Uno", "Dos", "Tres", "Cuatro"]) {
      const row = rowByName(name);
      fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
      fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
    }
    // Max 3 compact rows; the oldest net expired with an announcement
    // naming the survivors: 3 undo nets remain available.
    expect(screen.getAllByRole("button", { name: /deshacer/i })).toHaveLength(3);
    expect(screen.getByText(/se descartó el deshacer más antiguo/i)).toBeInTheDocument();
    expect(screen.getByText(/quedan 3 disponibles/i)).toBeInTheDocument();
  });

  it("ties the eviction notice to the oldest surviving group, not a 4s timer", () => {
    vi.useFakeTimers();
    try {
      const { add } = usePadronStore.getState();
      add({ nombre: "Uno", edadMeses: 24, nivelHemoglobina: 12.0 });
      add({ nombre: "Dos", edadMeses: 24, nivelHemoglobina: 12.0 });
      add({ nombre: "Tres", edadMeses: 24, nivelHemoglobina: 12.0 });
      add({ nombre: "Cuatro", edadMeses: 24, nivelHemoglobina: 12.0 });
      render(<PadronView />);
      for (const name of ["Uno", "Dos", "Tres", "Cuatro"]) {
        const row = rowByName(name);
        fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
        fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
      }
      // Past the old 4s timer the notice still stands: groups live 8s.
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.getByText(/se descartó el deshacer más antiguo/i)).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /deshacer/i })).toHaveLength(3);
      // Undoing the tied group (oldest surviving = Dos, rendered last)
      // dismisses the notice with it.
      const undoButtons = screen.getAllByRole("button", { name: /deshacer/i });
      fireEvent.click(undoButtons[undoButtons.length - 1]);
      expect(screen.getByText("Dos")).toBeInTheDocument();
      expect(screen.queryByText(/se descartó el deshacer más antiguo/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears a stale eviction notice on the next non-evicting delete", () => {
    const { add } = usePadronStore.getState();
    add({ nombre: "Uno", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Dos", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Tres", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Cuatro", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Cinco", edadMeses: 24, nivelHemoglobina: 12.0 });
    render(<PadronView />);
    for (const name of ["Uno", "Dos", "Tres", "Cuatro"]) {
      const row = rowByName(name);
      fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
      fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
    }
    expect(screen.getByText(/se descartó el deshacer más antiguo/i)).toBeInTheDocument();
    // Free a slot without touching the tied group (undo newest Cuatro):
    // notice survives because Dos is still pending.
    const newest = screen.getAllByRole("button", { name: /deshacer/i })[0];
    fireEvent.click(newest);
    expect(screen.getByText(/se descartó el deshacer más antiguo/i)).toBeInTheDocument();
    // Next delete fits without evicting: the stale notice clears.
    const row = rowByName("Cinco");
    fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
    fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
    expect(screen.queryByText(/se descartó el deshacer más antiguo/i)).not.toBeInTheDocument();
  });

  it("slides the row-delete fuse on interaction instead of expiring", () => {
    vi.useFakeTimers();
    try {
      seedTwo();
      render(<PadronView />);
      const row = rowByName("Luis Paz");
      fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
      expect(
        within(rowByName("Luis Paz")).getByRole("button", { name: /confirmar/i }),
      ).toBeInTheDocument();
      // 3s pass, then any keydown inside the group restarts the 4s fuse.
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      fireEvent.keyDown(
        within(rowByName("Luis Paz")).getByRole("button", { name: /confirmar/i }),
        { key: "a" },
      );
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      // 6s total, but the fuse slid: still armed.
      expect(
        within(rowByName("Luis Paz")).getByRole("button", { name: /confirmar/i }),
      ).toBeInTheDocument();
      // Without further interaction the fuse expires and disarms.
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(
        within(rowByName("Luis Paz")).getByRole("button", { name: /^eliminar$/i }),
      ).toBeInTheDocument();
      expect(usePadronStore.getState().pacientes).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("slides the bulk-delete fuse on pointer activity", () => {
    vi.useFakeTimers();
    try {
      seedTwo();
      render(<PadronView />);
      fireEvent.click(
        screen.getByRole("checkbox", { name: /seleccionar a ana torres/i }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: /eliminar seleccionados/i }),
      );
      expect(
        screen.getByRole("button", { name: /confirmar eliminación/i }),
      ).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      fireEvent.pointerOver(
        screen.getByRole("button", { name: /confirmar eliminación/i }),
      );
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(
        screen.getByRole("button", { name: /confirmar eliminación/i }),
      ).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(
        screen.queryByRole("button", { name: /confirmar eliminación/i }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("slides the dirty-discard fuse on interaction", () => {
    vi.useFakeTimers();
    try {
      seedTwo();
      render(<PadronView />);
      fireEvent.click(
        within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
      );
      fireEvent.change(screen.getByLabelText(/^nombre/i), {
        target: { value: "Cambiado" },
      });
      fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
      expect(
        screen.getByRole("button", { name: /descartar cambios/i }),
      ).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      fireEvent.keyDown(
        screen.getByRole("button", { name: /descartar cambios/i }),
        { key: "a" },
      );
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(
        screen.getByRole("button", { name: /descartar cambios/i }),
      ).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(
        screen.queryByRole("button", { name: /descartar cambios/i }),
      ).not.toBeInTheDocument();
      // Draft survived the whole slide: nothing discarded, still editing.
      expect(screen.getByLabelText(/^nombre/i)).toHaveValue("Cambiado");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("PadronView armed-confirm expiry cue", () => {
  it("announces a row-delete timeout expiry through the existing status line", () => {
    vi.useFakeTimers();
    try {
      seedTwo();
      render(<PadronView />);
      const row = rowByName("Luis Paz");
      fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
      // Armed, no announcement yet: the status line names only the count.
      expect(screen.getByRole("status")).not.toHaveTextContent(/se canceló/i);
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      // The silent fuse disarmed AND said so, politely, in Spanish.
      expect(
        within(rowByName("Luis Paz")).queryByRole("button", {
          name: /confirmar/i,
        }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(
        "Se canceló la confirmación.",
      );
      // The triage count survives beside the notice: one region, both facts.
      expect(screen.getByRole("status")).toHaveTextContent(
        /moderada \+ severa \(en vista\): 1 de 2/i,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("announces a bulk-delete timeout expiry the same way", () => {
    vi.useFakeTimers();
    try {
      seedTwo();
      render(<PadronView />);
      fireEvent.click(
        screen.getByRole("checkbox", { name: /seleccionar a ana torres/i }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: /eliminar seleccionados/i }),
      );
      expect(screen.getByRole("status")).not.toHaveTextContent(/se canceló/i);
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(
        screen.queryByRole("button", { name: /confirmar eliminación/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(
        "Se canceló la confirmación.",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("announces a dirty-discard timeout expiry and keeps the draft", () => {
    vi.useFakeTimers();
    try {
      seedTwo();
      render(<PadronView />);
      fireEvent.click(
        within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
      );
      fireEvent.change(screen.getByLabelText(/^nombre/i), {
        target: { value: "Cambiado" },
      });
      fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
      expect(
        screen.getByRole("button", { name: /descartar cambios/i }),
      ).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(
        screen.queryByRole("button", { name: /descartar cambios/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(
        "Se canceló la confirmación.",
      );
      // Draft survived the whole fuse: nothing discarded, still editing.
      expect(screen.getByLabelText(/^nombre/i)).toHaveValue("Cambiado");
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the notice on re-arm so the next expiry announces again", () => {
    vi.useFakeTimers();
    try {
      seedTwo();
      render(<PadronView />);
      const arm = () =>
        fireEvent.click(
          within(rowByName("Luis Paz")).getByRole("button", {
            name: /^eliminar$/i,
          }),
        );
      arm();
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.getByRole("status")).toHaveTextContent(
        "Se canceló la confirmación.",
      );
      // Re-arming clears the stale notice…
      arm();
      expect(screen.getByRole("status")).not.toHaveTextContent(/se canceló/i);
      // …so the next timeout announces again instead of changing nothing.
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.getByRole("status")).toHaveTextContent(
        "Se canceló la confirmación.",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays silent on manual disarms: Cancelar never announces", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Luis Paz");
    fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
    fireEvent.click(within(row).getByRole("button", { name: /cancelar/i }));
    // User-initiated, so no announcement: nothing expired on them.
    expect(screen.getByRole("status")).not.toHaveTextContent(/se canceló/i);
  });
});

describe("PadronView focus management + dirty-edit guard", () => {
  it("autofocuses Nombre when the edit row mounts", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
    );
    expect(document.activeElement).toBe(screen.getByLabelText(/^nombre/i));
  });

  it("moves focus to Deshacer after a confirmed single delete", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Luis Paz");
    fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
    fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /deshacer/i }),
    );
    expect(document.activeElement).not.toBe(document.body);
  });

  it("moves focus to Deshacer after a confirmed bulk delete", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /seleccionar a ana torres/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /eliminar seleccionados/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /confirmar eliminación/i }),
    );
    expect(document.activeElement).toBe(
      screen.getAllByRole("button", { name: /deshacer/i })[0],
    );
  });

  it("returns focus to Editar after Cancelar on a clean edit", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(
      screen.queryByRole("button", { name: /guardar/i }),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(
      within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
    );
  });

  it("arms and confirms the discard through Cancelar when dirty", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
    );
    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: "Cambiado" },
    });
    // First tap arms: still editing, nothing discarded.
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(
      screen.getByRole("button", { name: /descartar cambios/i }),
    ).toBeInTheDocument();
    // Armed row is binary: no Guardar, inputs locked.
    expect(
      screen.queryByRole("button", { name: /guardar/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^nombre/i)).toBeDisabled();
    // Confirming discards the draft and returns focus to Editar.
    fireEvent.click(
      screen.getByRole("button", { name: /descartar cambios/i }),
    );
    expect(
      screen.queryByRole("button", { name: /guardar/i }),
    ).not.toBeInTheDocument();
    expect(usePadronStore.getState().pacientes[0].nombre).toBe("Ana Torres");
    expect(document.activeElement).toBe(
      within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
    );
  });

  it("keeps the draft when Seguir editando disarms the prompt", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
    );
    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: "Cambiado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /seguir editando/i }),
    );
    // Draft intact, prompt gone, focus back where typing happens.
    expect(screen.getByLabelText(/^nombre/i)).toHaveValue("Cambiado");
    expect(
      screen.queryByRole("button", { name: /descartar cambios/i }),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText(/^nombre/i));
  });

  it("narrows the armed discard to a binary choice with locked inputs", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
    );
    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: "Cambiado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    // While armed the edit form offers exactly two actions: the
    // destructive confirm and the safe disarm — Guardar steps aside.
    const form = screen.getByLabelText(/^nombre/i).closest("form")!;
    expect(within(form).getAllByRole("button")).toHaveLength(2);
    expect(
      within(form).getByRole("button", { name: /descartar cambios/i }),
    ).toBeInTheDocument();
    expect(
      within(form).getByRole("button", { name: /seguir editando/i }),
    ).toBeInTheDocument();
    // All three inputs lock so there is nothing else to act on.
    expect(screen.getByLabelText(/^nombre/i)).toBeDisabled();
    expect(screen.getByLabelText(/edad/i)).toBeDisabled();
    expect(screen.getByLabelText(/hemoglobina/i)).toBeDisabled();
    // Disarming restores the full form with the draft intact.
    fireEvent.click(
      screen.getByRole("button", { name: /seguir editando/i }),
    );
    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^nombre/i)).toBeEnabled();
    expect(screen.getByLabelText(/edad/i)).toBeEnabled();
    expect(screen.getByLabelText(/hemoglobina/i)).toBeEnabled();
    expect(screen.getByLabelText(/^nombre/i)).toHaveValue("Cambiado");
    expect(document.activeElement).toBe(screen.getByLabelText(/^nombre/i));
  });

  it("switches rows silently when the open edit is clean", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
    );
    fireEvent.click(
      within(rowByName("Luis Paz")).getByRole("button", { name: /editar/i }),
    );
    expect(screen.getByText("Editando a Luis Paz")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /descartar cambios/i }),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText(/^nombre/i));
  });

  it("parks a row-switch behind the discard confirm when dirty", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
    );
    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: "Cambiado" },
    });
    // The switch does not land: Ana stays open with the discard prompt.
    fireEvent.click(
      within(rowByName("Luis Paz")).getByRole("button", { name: /editar/i }),
    );
    expect(screen.getByText("Editando a Ana Torres")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /descartar cambios/i }),
    ).toBeInTheDocument();
    // Confirming discards Ana's draft and completes the switch to Luis.
    fireEvent.click(
      screen.getByRole("button", { name: /descartar cambios/i }),
    );
    expect(screen.getByText("Editando a Luis Paz")).toBeInTheDocument();
    expect(usePadronStore.getState().pacientes[0].nombre).toBe("Ana Torres");
    expect(document.activeElement).toBe(screen.getByLabelText(/^nombre/i));
  });

  it("parks a filter clear behind the discard confirm when dirty", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "ana" },
    });
    fireEvent.click(
      within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
    );
    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: "Cambiado" },
    });
    // Limpiar does not clear while dirty: the discard prompt arms instead.
    fireEvent.click(screen.getByRole("button", { name: /limpiar/i }));
    expect(screen.getByLabelText(/buscar/i)).toHaveValue("ana");
    expect(
      screen.getByRole("button", { name: /descartar cambios/i }),
    ).toBeInTheDocument();
    // Confirming applies the parked clear and lands on the filter anchor.
    fireEvent.click(
      screen.getByRole("button", { name: /descartar cambios/i }),
    );
    expect(screen.getByLabelText(/buscar/i)).toHaveValue("");
    expect(screen.getByText("Luis Paz")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText(/buscar/i));
  });

  it("clears the filter silently when the open edit is clean", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "ana" },
    });
    fireEvent.click(
      within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /limpiar/i }));
    // Clean: no prompt, the edit stays open, the filter clears.
    expect(screen.getByLabelText(/buscar/i)).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: /descartar cambios/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
  });
});

describe("PadronView export actions", () => {
  function readBlobText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
  }

  function mockDownloadSeam() {
    const seen: { blob: Blob | null; url: string | null } = {
      blob: null,
      url: null,
    };
    const clicks: string[] = [];
    (
      globalThis.URL as unknown as Record<string, unknown>
    ).createObjectURL = (blob: Blob) => {
      seen.blob = blob;
      seen.url = "blob:mock-csv";
      return "blob:mock-csv";
    };
    (
      globalThis.URL as unknown as Record<string, unknown>
    ).revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        clicks.push(this.download);
      },
    );
    return { seen, clicks };
  }

  it("always renders Exportar CSV and Imprimir beside the table", () => {
    seedTwo();
    render(<PadronView />);
    expect(
      screen.getByRole("button", { name: /exportar csv/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /imprimir/i }),
    ).toBeInTheDocument();
  });

  it("disables both actions when the filter matches no row", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "zzz" },
    });
    expect(
      screen.getByRole("button", { name: /exportar csv/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /imprimir/i })).toBeDisabled();
  });

  it("renders no export or print actions in the empty state", () => {
    const { clicks } = mockDownloadSeam();
    render(<PadronView />);
    expect(screen.getByText(/no hay pacientes registrados/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /exportar csv/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /imprimir/i }),
    ).not.toBeInTheDocument();
    expect(clicks).toHaveLength(0);
  });

  it("exports the visible rows through the Blob/URL seam with a dated filename", async () => {
    const { buildPadronCsv, padronFilename } = await import(
      "../lib/padronExport"
    );
    seedTwo();
    const { seen, clicks } = mockDownloadSeam();
    render(<PadronView />);
    fireEvent.click(screen.getByRole("button", { name: /exportar csv/i }));
    expect(seen.blob).toBeInstanceOf(Blob);
    const text = await readBlobText(seen.blob!);
    const expected = buildPadronCsv(
      usePadronStore.getState().pacientes,
      new Date(),
    );
    // FileReader strips the BOM on decode; byte size proves it survived.
    expect(text).toBe(expected.replace(/^\uFEFF/, ""));
    expect(seen.blob!.size).toBe(new Blob([expected]).size);
    expect(clicks).toEqual([padronFilename(new Date())]);
  });

  it("exports only the filtered visible rows", async () => {
    seedTwo();
    const { seen } = mockDownloadSeam();
    render(<PadronView />);
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: /exportar csv/i }));
    const text = await readBlobText(seen.blob!);
    expect(text).toContain("Ana Torres");
    expect(text).not.toContain("Luis Paz");
    expect(text).toContain("# total: 1");
  });

  it("exports only the selected rows through Exportar seleccionados", async () => {
    seedTwo();
    const { seen } = mockDownloadSeam();
    render(<PadronView />);
    // Bulk bar appears only with a selection.
    expect(
      screen.queryByRole("button", { name: /exportar seleccionados/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /seleccionar a luis paz/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /exportar seleccionados/i }),
    );
    const text = await readBlobText(seen.blob!);
    expect(text).toContain("Luis Paz");
    expect(text).not.toContain("Ana Torres");
    expect(text).toContain("# total: 1");
  });

  it("exports selected ∩ visible only when a filter hides a selection", async () => {
    seedTwo();
    const { seen } = mockDownloadSeam();
    render(<PadronView />);
    fireEvent.click(
      selectAllBoxes().header,
    );
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "ana" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /exportar seleccionados/i }),
    );
    const text = await readBlobText(seen.blob!);
    expect(text).toContain("Ana Torres");
    expect(text).not.toContain("Luis Paz");
    expect(text).toContain("# total: 1");
  });

  it("excludes soft-deleted tombstones from the CSV export (B2)", async () => {
    seedTwo();
    const id = usePadronStore.getState().pacientes[1].id;
    usePadronStore.getState().remove(id);
    const { seen } = mockDownloadSeam();
    render(<PadronView />);
    fireEvent.click(screen.getByRole("button", { name: /exportar csv/i }));
    const text = await readBlobText(seen.blob!);
    expect(text).toContain("Ana Torres");
    expect(text).not.toContain("Luis Paz");
    expect(text).toContain("# total: 1");
  });

  it("calls window.print when Imprimir activates", () => {
    seedTwo();
    const printSpy = vi.fn();
    Object.defineProperty(window, "print", {
      value: printSpy,
      configurable: true,
      writable: true,
    });
    render(<PadronView />);
    fireEvent.click(screen.getByRole("button", { name: /imprimir/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});

describe("PadronView bulk scope + print sync state", () => {
  it("names the bulk count as the visible view, never the whole padron", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /seleccionar a ana torres/i }),
    );
    expect(screen.getByText("1 seleccionado en vista")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /seleccionar a luis paz/i }),
    );
    expect(screen.getByText("2 seleccionados en vista")).toBeInTheDocument();
  });

  it("keeps the select-all scope on the visible patients", () => {
    seedTwo();
    render(<PadronView />);
    expect(selectAllBoxes().header).toBeInTheDocument();
  });

  it("prints the pending count with a fecha+hora generation stamp", () => {
    resetSyncGuardForTests();
    seedTwo();
    const { container } = render(<PadronView />);
    const header = container.querySelector(".padron-print-header");
    expect(header).not.toBeNull();
    // Paper reuses the chip vocabulary verbatim: pending count + receipt.
    expect(header).toHaveTextContent("2 por sincronizar");
    expect(header).toHaveTextContent("Aún sin sincronizar");
    // Absolute generation stamp (fecha + hora) anchors the frozen line.
    expect(header).toHaveTextContent(/impreso:/i);
    expect(header?.textContent).toMatch(/\d{1,2}:\d{2}/);
    expect(header).not.toHaveTextContent(/hace/i);
  });

  it("prints the clean state with the same generation stamp", () => {
    resetSyncGuardForTests();
    seedTwo();
    const { markSynced } = usePadronStore.getState();
    markSynced(usePadronStore.getState().pacientes.map((p) => p.id));
    recordPull(Date.now() - 125_000);
    const { container } = render(<PadronView />);
    const header = container.querySelector(".padron-print-header");
    // Same two strings as the chip: local-safe status + last-sync receipt.
    expect(header).toHaveTextContent("A salvo en este equipo");
    expect(header).toHaveTextContent("Última sincronización hace 2 min");
    expect(header).toHaveTextContent(/impreso:/i);
    expect(header?.textContent).toMatch(/\d{1,2}:\d{2}/);
  });

  it("titles the print header with the es-PE date: one grammar per surface, no ISO on paper", () => {
    resetSyncGuardForTests();
    seedTwo();
    const { container } = render(<PadronView />);
    const header = container.querySelector(".padron-print-header");
    expect(header).not.toBeNull();
    // Title date comes from the SAME es-PE formatter as Impreso
    // (date-only variant, e.g. "4 oct 2026").
    const expectedDate = new Intl.DateTimeFormat("es-PE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date());
    expect(header).toHaveTextContent(`Padrón de pacientes — ${expectedDate}`);
    // ISO lives only in padronFilename/CSV machine artifacts, never paper.
    expect(header?.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("prints the Hb average in the shared one-decimal voice", () => {
    resetSyncGuardForTests();
    seedTwo();
    const { container } = render(<PadronView />);
    const header = container.querySelector(".padron-print-header");
    // (12.0 + 6.5) / 2 = 9.25 → 9.3: the same formatHb voice as the
    // dashboard KPI and the CSV stats, so paper never disagrees.
    expect(header).toHaveTextContent("Promedio Hb: 9.3 g/dL");
  });
});

describe("PadronView phone surface (P2-1, Option A)", () => {
  it("hooks the thead for the below-sm card reflow while the table stays in print", () => {
    seedTwo();
    const { container } = render(<PadronView />);
    // Single DOM: the screen-only CSS stacks rows into cards below sm;
    // the table itself is never hidden, so print keeps the 6-column table.
    const thead = container.querySelector("thead.padron-thead");
    expect(thead).not.toBeNull();
    expect(container.querySelector("table.padron-table")).not.toBeNull();
    expect(
      container.querySelector(".padron-print-header"),
    ).not.toBeNull();
  });

  it("labels edad and Hb inline so the stacked card reads without headers", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Ana Torres");
    const edadLabel = within(row).getByText("Edad (meses):");
    expect(edadLabel.className).toMatch(/sm:hidden/);
    expect(edadLabel.className).toMatch(/print:hidden/);
    const hbLabel = within(row).getByText("Hemoglobina (g/dL):");
    expect(hbLabel.className).toMatch(/sm:hidden/);
    expect(hbLabel.className).toMatch(/print:hidden/);
    // Values stay plain text beside their labels.
    expect(within(row).getByText("24", { exact: true })).toBeInTheDocument();
  });

  it("marks data cells with card hooks (nombre leads, Hb inline as text)", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Ana Torres");
    const cells = within(row).getAllByRole("cell");
    expect(cells[1].className).toMatch(/padron-cell-nombre/);
    expect(cells[2].className).toMatch(/padron-cell-edad/);
    expect(cells[3].className).toMatch(/padron-cell-hb/);
    expect(cells[4].className).toMatch(/padron-cell-dx/);
  });

  it("drives the same visible scope from the mobile select-all", () => {
    seedTwo();
    render(<PadronView />);
    const { mobile } = selectAllBoxes();
    // The phone control lives outside the table and skips print…
    expect(screen.getByRole("table").contains(mobile)).toBe(false);
    expect(mobile.closest("div")?.className).toMatch(/sm:hidden/);
    expect(mobile.closest("div")?.className).toMatch(/print:hidden/);
    // …but toggles exactly the filtered set, like the header checkbox.
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "ana" },
    });
    fireEvent.click(mobile);
    expect(screen.getByText("1 seleccionado en vista")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /seleccionar a ana torres/i }),
    ).toBeChecked();
    expect(
      screen.queryByRole("checkbox", { name: /seleccionar a luis paz/i }),
    ).not.toBeInTheDocument();
  });

  it("reports the mixed state on the mobile select-all too", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /seleccionar a ana torres/i }),
    );
    expect(
      (selectAllBoxes().mobile as HTMLInputElement).indeterminate,
    ).toBe(true);
  });

  it("keeps row actions and the edit form inside the card rows", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Ana Torres");
    expect(
      within(row).getByRole("button", { name: /editar/i }),
    ).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: /editar/i }));
    // The edit form renders (colspan row becomes a card below sm).
    expect(screen.getByText("Editando a Ana Torres")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
  });
});

describe("PadronView edit-row duplicate parity (P2-3)", () => {
  function openEditFor(name: string) {
    fireEvent.click(
      within(rowByName(name)).getByRole("button", { name: /editar/i }),
    );
  }

  it("warns inline before committing a duplicate rename, never blocking", () => {
    seedTwo();
    render(<PadronView />);
    openEditFor("Luis Paz");
    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: "Ana Torres" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    // Same copy as the create form…
    expect(screen.getByText(/posible duplicado/i)).toHaveTextContent(
      "Posible duplicado: ya existe un paciente llamado Ana Torres.",
    );
    expect(screen.getByText(/posible duplicado/i).className).toMatch(
      /text-warning/,
    );
    // …and nothing committed: the row stays open, the store untouched.
    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
    expect(
      usePadronStore.getState().pacientes.find((p) => p.nombre === "Luis Paz"),
    ).toBeDefined();
  });

  it("commits after the warning is dismissed, then saves silently", () => {
    seedTwo();
    render(<PadronView />);
    openEditFor("Luis Paz");
    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: "Ana Torres" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    expect(screen.getByText(/posible duplicado/i)).toBeInTheDocument();
    // Descartar acknowledges the current nombre (outside the live region).
    const warning = screen.getByText(/posible duplicado/i);
    const liveRegion = warning.closest('[role="status"]')!;
    expect(liveRegion.querySelector("button")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^descartar$/i }));
    expect(screen.queryByText(/posible duplicado/i)).not.toBeInTheDocument();
    // The second Guardar commits.
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    expect(
      screen.queryByRole("button", { name: /guardar/i }),
    ).not.toBeInTheDocument();
    expect(
      usePadronStore.getState().pacientes.filter((p) => p.nombre === "Ana Torres"),
    ).toHaveLength(2);
  });

  it("never warns against its own row when the nombre is untouched", () => {
    seedTwo();
    render(<PadronView />);
    openEditFor("Ana Torres");
    fireEvent.change(screen.getByLabelText(/hemoglobina/i), {
      target: { value: "8.0" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    expect(screen.queryByText(/posible duplicado/i)).not.toBeInTheDocument();
    expect(usePadronStore.getState().pacientes[0].diagnostico).toBe(
      "Anemia Moderada",
    );
  });

  it("saves a unique rename silently", () => {
    seedTwo();
    render(<PadronView />);
    openEditFor("Luis Paz");
    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: "Luis Paz Nuevo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    expect(screen.queryByText(/posible duplicado/i)).not.toBeInTheDocument();
    expect(
      usePadronStore.getState().pacientes.find((p) => p.nombre === "Luis Paz Nuevo"),
    ).toBeDefined();
  });

  it("names the count when several patients share the target name", () => {
    const { add } = usePadronStore.getState();
    add({ nombre: "María López", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Maria Lopez", edadMeses: 30, nivelHemoglobina: 11.0 });
    add({ nombre: "Luis Paz", edadMeses: 28, nivelHemoglobina: 12.0 });
    render(<PadronView />);
    openEditFor("Luis Paz");
    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: "maria lopez" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    // Row badges already quote "Posible duplicado": pin the inline edit
    // warning inside the row form, not the badges.
    const editForm = screen
      .getByRole("button", { name: /guardar/i })
      .closest("form")!;
    expect(within(editForm).getByText(/posible duplicado/i)).toHaveTextContent(
      "Posible duplicado: ya existen 2 pacientes con ese nombre. Revisa el padrón antes de registrar.",
    );
    expect(
      usePadronStore.getState().pacientes.find((p) => p.nombre === "Luis Paz"),
    ).toBeDefined();
  });

  it("keeps validation ahead of the duplicate check", () => {
    seedTwo();
    render(<PadronView />);
    openEditFor("Luis Paz");
    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: "Ana Torres" },
    });
    fireEvent.change(screen.getByLabelText(/edad/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    // Field error wins; no duplicate warning yet, nothing saved. (Empty
    // reaches the handler; an out-of-range number would be blocked natively
    // first — same order, earlier layer.)
    expect(screen.getByRole("alert")).toHaveTextContent(
      "La edad debe estar entre 6 y 59 meses.",
    );
    expect(screen.queryByText(/posible duplicado/i)).not.toBeInTheDocument();
    expect(
      usePadronStore.getState().pacientes.find((p) => p.nombre === "Luis Paz"),
    ).toBeDefined();
  });
});

describe("PadronView capacity signal (P3)", () => {
  function seedMany(count: number) {
    const { add } = usePadronStore.getState();
    for (let i = 1; i <= count; i++) {
      add({ nombre: `Paciente ${i}`, edadMeses: 24, nivelHemoglobina: 12.0 });
    }
  }

  it("stays quiet under 80 records", () => {
    seedMany(79);
    render(<PadronView />);
    expect(screen.queryByTestId("padron-capacity")).not.toBeInTheDocument();
  });

  it("shows the total-registered count from 80 on, muted and calm", () => {
    seedMany(80);
    render(<PadronView />);
    const counter = screen.getByTestId("padron-capacity");
    expect(counter).toHaveTextContent("80 de 100 pacientes");
    expect(counter.className).toMatch(/text-muted-foreground/);
    expect(counter.className).not.toMatch(/destructive|warning/);
  });

  it("counts total registered, never the filtered view", () => {
    seedMany(87);
    render(<PadronView />);
    expect(screen.getByTestId("padron-capacity")).toHaveTextContent("87 de 100 pacientes");
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "Paciente 8" },
    });
    // Visible slice narrows; the capacity signal holds the total.
    expect(screen.getByTestId("padron-capacity")).toHaveTextContent("87 de 100 pacientes");
  });

  it("reads 100 de 100 at the cap with no alarm styling", () => {
    seedMany(100);
    render(<PadronView />);
    const counter = screen.getByTestId("padron-capacity");
    expect(counter).toHaveTextContent("100 de 100 pacientes");
    expect(counter.className).toMatch(/text-muted-foreground/);
    expect(counter.className).not.toMatch(/destructive/);
  });
});

describe("PadronView edit-save undo (P2-2)", () => {
  function saveHbEdit(name: string, hb: string) {
    const row = rowByName(name);
    fireEvent.click(within(row).getByRole("button", { name: /editar/i }));
    fireEvent.change(screen.getByLabelText(/hemoglobina/i), {
      target: { value: hb },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
  }

  it("restores pre-save values when Deshacer follows a Guardar", () => {
    seedTwo();
    render(<PadronView />);
    const row = rowByName("Ana Torres");
    fireEvent.click(within(row).getByRole("button", { name: /editar/i }));
    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: "Ana Cambiada" },
    });
    fireEvent.change(screen.getByLabelText(/hemoglobina/i), {
      target: { value: "8.0" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    // Same toast family as deletes: what happened plus Deshacer recovery.
    expect(screen.getByText("Cambios guardados.")).toBeInTheDocument();
    expect(screen.getByText("Ana Cambiada")).toBeInTheDocument();
    expect(usePadronStore.getState().pacientes[0].diagnostico).toBe(
      "Anemia Moderada",
    );
    fireEvent.click(screen.getByRole("button", { name: /deshacer/i }));
    // Pre-save values restored, diagnosis recomputed, edit stays closed.
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    const restored = usePadronStore.getState().pacientes[0];
    expect(restored.nombre).toBe("Ana Torres");
    expect(restored.nivelHemoglobina).toBe(12.0);
    expect(restored.diagnostico).toBe("Normal");
    // The revert is itself a local change: requeued dirty for the next push.
    expect(restored.dirty).toBe(true);
    expect(
      screen.queryByRole("button", { name: /guardar/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /deshacer/i }),
    ).not.toBeInTheDocument();
  });

  it("moves focus to Deshacer after a Guardar, like deletes", () => {
    seedTwo();
    render(<PadronView />);
    saveHbEdit("Ana Torres", "8.0");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /deshacer/i }),
    );
    expect(document.activeElement).not.toBe(document.body);
  });

  it("evicts the oldest group when an edit-save lands at capacity 3", () => {
    const { add } = usePadronStore.getState();
    add({ nombre: "Uno", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Dos", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Tres", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Cuatro", edadMeses: 24, nivelHemoglobina: 12.0 });
    render(<PadronView />);
    for (const name of ["Uno", "Dos", "Tres"]) {
      const row = rowByName(name);
      fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
      fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
    }
    expect(screen.getAllByRole("button", { name: /deshacer/i })).toHaveLength(3);
    // The 4th push is an edit-save: the oldest delete (Uno) evicts honestly.
    saveHbEdit("Cuatro", "8.0");
    expect(screen.getByText("Cambios guardados.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /deshacer/i })).toHaveLength(3);
    expect(
      screen.getByText(/se descartó el deshacer más antiguo/i),
    ).toBeInTheDocument();
    // Newest group (the edit) undoes first and restores Cuatro's Hb.
    fireEvent.click(screen.getAllByRole("button", { name: /deshacer/i })[0]);
    const cuatro = usePadronStore
      .getState()
      .pacientes.find((p) => p.nombre === "Cuatro")!;
    expect(cuatro.nivelHemoglobina).toBe(12.0);
    expect(cuatro.diagnostico).toBe("Normal");
    expect(screen.getAllByRole("button", { name: /deshacer/i })).toHaveLength(2);
    // Uno stays deleted: its net expired with the eviction.
    expect(screen.queryByText("Uno")).not.toBeInTheDocument();
  });

  it("expires an edit-save toast on the 8s wall clock with sliding interaction", () => {
    vi.useFakeTimers();
    try {
      seedTwo();
      render(<PadronView />);
      saveHbEdit("Ana Torres", "8.0");
      expect(screen.getByText("Cambios guardados.")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(7000);
      });
      // Activity inside the toast row slides the 8s window, like deletes.
      fireEvent.pointerOver(
        screen.getByRole("button", { name: /deshacer/i }),
      );
      act(() => {
        vi.advanceTimersByTime(7000);
      });
      expect(screen.getByText("Cambios guardados.")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(8000);
      });
      expect(
        screen.queryByText("Cambios guardados."),
      ).not.toBeInTheDocument();
      // Expiry only drops the recovery net: the save itself stands.
      expect(usePadronStore.getState().pacientes[0].nivelHemoglobina).toBe(8.0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("PadronView dismiss grammar (P3)", () => {
  it("keeps one dismiss word per surface: Cancelar, Cerrar aviso, Descartar cambios?", () => {
    seedTwo();
    render(<PadronView />);
    // Armed delete confirm disarms with Cancelar (row guard).
    const row = rowByName("Luis Paz");
    fireEvent.click(within(row).getByRole("button", { name: /^eliminar$/i }));
    expect(
      within(row).getByRole("button", { name: /^cancelar$/i }),
    ).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: /confirmar/i }));
    // Undo toast dismisses with Cerrar aviso (tombstone stays).
    expect(
      screen.getByRole("button", { name: /cerrar aviso/i }),
    ).toBeInTheDocument();
    // Dirty edit arms Descartar cambios? (never Cancelar for the loss).
    fireEvent.click(
      within(rowByName("Ana Torres")).getByRole("button", { name: /editar/i }),
    );
    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: "Cambiado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(
      screen.getByRole("button", { name: /descartar cambios/i }),
    ).toBeInTheDocument();
  });
});

describe("PadronView phone sync affordance (run-22 P2-2)", () => {
  function setOnline(value: boolean) {
    Object.defineProperty(window.navigator, "onLine", {
      value,
      configurable: true,
    });
  }

  // The repo .env carries Supabase credentials: without this the sync
  // clicks below would attempt a real network push. Force the
  // unconfigured state (same approach as App.test.tsx) so the shared
  // handler fails fast with the honest unconfigured cause.
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    resetSupabaseClientForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    setOnline(true);
  });

  it("renders a phone-only sync row with the shared pending vocabulary", () => {
    resetSyncGuardForTests();
    setOnline(true);
    seedTwo();
    render(<PadronView />);
    try {
      const row = screen.getByTestId("padron-sync-phone");
      // Phone surface only (CSS contract, same pin grammar as the mobile
      // select-all): off desktop, off paper.
      expect(row.className).toMatch(/sm:hidden/);
      expect(row.className).toMatch(/print:hidden/);
      // Same syncGuard strings as the chip, never a divergent phrasing.
      expect(row).toHaveTextContent("2 por sincronizar");
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

  it("stays quiet when clean and online, like the chip", () => {
    resetSyncGuardForTests();
    setOnline(true);
    seedTwo();
    const ids = usePadronStore.getState().pacientes.map((p) => p.id);
    usePadronStore.getState().markSynced(ids);
    render(<PadronView />);
    expect(screen.queryByTestId("padron-sync-phone")).not.toBeInTheDocument();
  });

  it("names the offline state with no action, mirroring the chip", () => {
    resetSyncGuardForTests();
    setOnline(false);
    seedTwo();
    render(<PadronView />);
    try {
      const row = screen.getByTestId("padron-sync-phone");
      expect(row).toHaveTextContent(/sin conexión/i);
      expect(row).toHaveTextContent("2 por sincronizar");
      expect(
        within(row).queryByRole("button", { name: /sincronizar/i }),
      ).not.toBeInTheDocument();
    } finally {
      setOnline(true);
    }
  });

  it("runs the shared sync handler from the phone button", async () => {
    resetSyncGuardForTests();
    setOnline(true);
    seedTwo();
    render(<PadronView />);
    try {
      fireEvent.click(
        within(screen.getByTestId("padron-sync-phone")).getByRole("button", {
          name: /^sincronizar$/i,
        }),
      );
      // Offline-first test shell: no Supabase credentials, so the shared
      // handler runs and the phone button flips to retry — proving the
      // phone surface fires the real sync, not a stub.
      expect(
        await within(screen.getByTestId("padron-sync-phone")).findByRole(
          "button",
          { name: /reintentar/i },
        ),
      ).toHaveAttribute("data-sync-action", "true");
    } finally {
      setOnline(true);
    }
  });

  it("wraps the header actions beneath the title at 360px", () => {
    seedTwo();
    render(<PadronView />);
    // jsdom can't do layout: pin the wrap contract on the header row.
    const header = screen
      .getByText("Padrón de pacientes")
      .closest("div")!;
    expect(header.className).toMatch(/flex-wrap/);
    expect(header.className).toMatch(/justify-between/);
  });

  it("announces the shared failure copy as an alert line under the phone row", async () => {
    resetSyncGuardForTests();
    setOnline(true);
    seedTwo();
    render(<PadronView />);
    try {
      fireEvent.click(
        within(screen.getByTestId("padron-sync-phone")).getByRole("button", {
          name: /^sincronizar$/i,
        }),
      );
      // Same error string source as the chip's alert, never a copy.
      const row = screen.getByTestId("padron-sync-phone");
      const alert = await within(row).findByRole("alert");
      expect(alert).toHaveTextContent(/no está configurada/i);
      // Quiet styling consistent with the chip alert.
      expect(alert.className).toMatch(/text-destructive/);
    } finally {
      setOnline(true);
    }
  });

  it("keeps Alt+G working with both surfaces mounted (shell query resolves)", async () => {
    resetSyncGuardForTests();
    setOnline(true);
    seedTwo();
    render(
      <>
        <SyncStatusChip />
        <PadronView />
      </>,
    );
    try {
      // Both surfaces render an enabled action: the expanded chip and the
      // phone row share one hook, one tag, one enabled grammar.
      const actions = document.querySelectorAll(
        'button[data-sync-action="true"]:not([disabled])',
      );
      expect(actions).toHaveLength(2);
      // The exact shell query still resolves to an enabled button — Alt+G
      // fires the first in DOM order (the sidebar instance); both run the
      // same guarded handler, so either target syncs.
      const shellTarget = document.querySelector<HTMLButtonElement>(
        'button[data-sync-action="true"]:not([disabled])',
      );
      expect(shellTarget).not.toBeNull();
      expect(shellTarget).not.toBeDisabled();
      fireEvent.click(shellTarget!);
      // The shared handler ran: the module-owned error surfaces on BOTH
      // mounted surfaces with the identical string (never a double with
      // competing copy — one source, two announcers).
      const alerts = await screen.findAllByRole("alert");
      expect(alerts).toHaveLength(2);
      for (const alert of alerts) {
        expect(alert).toHaveTextContent(/no está configurada/i);
      }
    } finally {
      setOnline(true);
    }
  });
});

describe("PadronView contextual help (run-22 P3-3)", () => {
  it("teaches the view-scoped steps behind a quiet disclosure", () => {
    seedTwo();
    render(<PadronView />);
    const help = screen.getByTestId("padron-help");
    expect(help).toHaveTextContent(/¿cómo funciona\?/i);
    // View-scoped copy (bulk scope, confirm + undo, sync, export/print) —
    // never the capture steps verbatim.
    for (const step of [
      /solo alcanzan lo visible/i,
      /deshacer recupera/i,
      /alt\+g/i,
      /exporta o imprime/i,
    ]) {
      expect(help).toHaveTextContent(step);
    }
    // Quiet styling matching RegisterForm's disclosure.
    expect(help.className).toMatch(/text-muted-foreground/);
  });

  it("mounts the same help disclosure in the empty state", () => {
    render(<PadronView />);
    expect(screen.getByText(/no hay pacientes registrados/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const help = screen.getByTestId("padron-help");
    expect(help).toHaveTextContent(/¿cómo funciona\?/i);
    // Same view-scoped copy as the populated branch, never a second text.
    for (const step of [
      /solo alcanzan lo visible/i,
      /deshacer recupera/i,
      /alt\+g/i,
      /exporta o imprime/i,
    ]) {
      expect(help).toHaveTextContent(step);
    }
  });

  it("shows the shared pending line in the empty state while dirty tombstones await push", () => {
    seedTwo();
    const ids = usePadronStore.getState().pacientes.map((p) => p.id);
    for (const id of ids) usePadronStore.getState().remove(id);
    render(<PadronView />);
    // Wiped view, but the deletes are dirty: the empty state must not read clean.
    expect(screen.getByText(/no hay pacientes registrados/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByTestId("padron-pending")).toHaveTextContent(
      "2 por sincronizar",
    );
  });

  it("shows no pending line in the empty state when nothing awaits push", () => {
    render(<PadronView />);
    expect(screen.getByText(/no hay pacientes registrados/i)).toBeInTheDocument();
    expect(screen.queryByTestId("padron-pending")).not.toBeInTheDocument();
  });
});

describe("PadronView duplicate badge action (run-25 P2-1)", () => {
  function seedTwins() {
    const { add } = usePadronStore.getState();
    add({ nombre: "María López", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Maria Lopez", edadMeses: 30, nivelHemoglobina: 11.0 });
    add({ nombre: "Luis Paz", edadMeses: 28, nivelHemoglobina: 12.0 });
  }

  it("renders the duplicate badge as a button that names its next step", () => {
    seedTwins();
    render(<PadronView />);
    // One badge-button per twin; the unique row has none.
    const badges = screen.getAllByRole("button", {
      name: /filtrar por este nombre para revisar duplicados/i,
    });
    expect(badges).toHaveLength(2);
    for (const badge of badges) {
      // Badge look kept, action affordance added.
      expect(badge).toHaveTextContent("Posible duplicado");
      expect(badge.tagName).toBe("BUTTON");
      expect(badge).toHaveAttribute("type", "button");
    }
    expect(
      within(rowByName("Luis Paz")).queryByRole("button", {
        name: /filtrar por este nombre/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("lands on the suspected twins when the badge is tapped", () => {
    seedTwins();
    render(<PadronView />);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: /filtrar por este nombre para revisar duplicados/i,
      })[0],
    );
    // Same setter as the filter input: the input reflects the badge tap…
    expect(screen.getByLabelText(/buscar por nombre/i)).toHaveValue(
      "María López",
    );
    // …and the table narrows to the twins (bulk scope follows: the bar
    // derives from this same visible slice).
    expect(screen.getByText("María López")).toBeInTheDocument();
    expect(screen.getByText("Maria Lopez")).toBeInTheDocument();
    expect(screen.queryByText("Luis Paz")).not.toBeInTheDocument();
  });
});

describe("PadronView edit-row native bounds (run-25 P2-2)", () => {
  function openEditFor(name: string) {
    fireEvent.click(
      within(rowByName(name)).getByRole("button", { name: /editar/i }),
    );
  }

  it("constrains Edad/Hb early with native bounds, keeping inputMode", () => {
    seedTwo();
    render(<PadronView />);
    openEditFor("Ana Torres");
    const edad = screen.getByLabelText(/edad/i);
    expect(edad).toHaveAttribute("type", "number");
    expect(edad).toHaveAttribute("min", "6");
    expect(edad).toHaveAttribute("max", "59");
    expect(edad).toHaveAttribute("step", "1");
    expect(edad).toHaveAttribute("inputmode", "numeric");
    const hb = screen.getByLabelText(/hemoglobina/i);
    expect(hb).toHaveAttribute("type", "number");
    expect(hb).toHaveAttribute("min", "0.1");
    expect(hb).toHaveAttribute("step", "0.1");
    expect(hb).toHaveAttribute("inputmode", "decimal");
  });

  it("blocks out-of-range edit values natively; the backstop owns the rest", () => {
    seedTwo();
    render(<PadronView />);
    openEditFor("Ana Torres");
    const edad = screen.getByLabelText(/edad/i) as HTMLInputElement;
    fireEvent.change(edad, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    // Native layer first: the submit never reaches the handler, so the row
    // stays open with no inline error and nothing saved.
    expect(edad.validity.rangeUnderflow).toBe(true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
    expect(usePadronStore.getState().pacientes[0].edadMeses).toBe(24);
    // Backstop: an empty value passes native (no required) and the Spanish
    // validation rejects it with the same clinical copy.
    fireEvent.change(edad, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    const alerts = screen.getAllByRole("alert");
    expect(alerts.some((a) => /edad debe estar entre 6 y 59/i.test(a.textContent ?? ""))).toBe(true);
    expect(usePadronStore.getState().pacientes[0].edadMeses).toBe(24);
  });
});

describe("PadronView bulk rest hint (run-25 P3-2)", () => {
  it("hints the bulk bar at rest and yields to the bar on selection", () => {
    seedTwo();
    render(<PadronView />);
    expect(
      screen.getByText("Selecciona pacientes para acciones en lote"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /seleccionar a ana torres/i }),
    );
    expect(
      screen.queryByText("Selecciona pacientes para acciones en lote"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1 seleccionado en vista")).toBeInTheDocument();
  });

  it("stays hidden when the filter matches nothing", () => {
    seedTwo();
    render(<PadronView />);
    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: "zzz" },
    });
    expect(screen.getByText(/sin resultados/i)).toBeInTheDocument();
    expect(
      screen.queryByText("Selecciona pacientes para acciones en lote"),
    ).not.toBeInTheDocument();
  });
});
