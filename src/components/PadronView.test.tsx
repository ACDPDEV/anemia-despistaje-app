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

  it("renders graves-first as a design-system checkbox with label association", () => {
    seedTwo();
    render(<PadronView />);
    const toggle = screen.getByRole("checkbox", { name: /graves primero/i });
    // Native input restyled with theme tokens, not a raw checkbox.
    expect(toggle).toHaveAttribute("data-slot", "checkbox");
    expect(toggle.tagName).toBe("INPUT");
    // Label association survives the swap.
    expect(screen.getByLabelText(/graves primero/i)).toBe(toggle);
    // 44px touch hit area comes from the label row on coarse pointers.
    expect(toggle.closest("label")?.className).toMatch(/pointer-coarse:min-h-11/);
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

    // Break only edad: nombre and hb stay valid and unwired.
    fireEvent.change(screen.getByLabelText(/edad/i), {
      target: { value: "5" },
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

  it("renders both actions disabled with the empty state and downloads nothing", () => {
    const { clicks } = mockDownloadSeam();
    render(<PadronView />);
    expect(screen.getByText(/no hay pacientes registrados/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /exportar csv/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /imprimir/i })).toBeDisabled();
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
