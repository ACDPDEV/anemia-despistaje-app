import { beforeEach, describe, expect, it } from "vitest";
import { MAX_PADRON, usePadronStore } from "./padronStore";

function addPatient(overrides: Record<string, unknown> = {}) {
  usePadronStore.getState().add({
    nombre: "Ana Torres",
    edadMeses: 24,
    nivelHemoglobina: 10.5,
    ...overrides,
  } as never);
}

beforeEach(() => {
  localStorage.clear();
  usePadronStore.getState().reset();
});

describe("padronStore", () => {
  it("registers a valid patient with the evaluator-assigned diagnosis", () => {
    addPatient({ nivelHemoglobina: 12.0 });
    const { pacientes } = usePadronStore.getState();
    expect(pacientes).toHaveLength(1);
    expect(pacientes[0].diagnostico).toBe("Normal");
    expect(pacientes[0].dirty).toBe(true);
  });

  it("rejects invalid data with a Spanish message", () => {
    expect(() => addPatient({ nombre: "  " })).toThrow(/nombre/i);
    expect(() => addPatient({ edadMeses: 5 })).toThrow(/edad/i);
    expect(() => addPatient({ edadMeses: 60 })).toThrow(/edad/i);
    expect(() => addPatient({ nivelHemoglobina: 0 })).toThrow(/hemoglobina/i);
    expect(usePadronStore.getState().pacientes).toHaveLength(0);
  });

  it("rejects non-integer and NaN ages with an edad message (B1)", () => {
    expect(() => addPatient({ edadMeses: 6.5 })).toThrow(/edad/i);
    expect(() => addPatient({ edadMeses: NaN })).toThrow(/edad/i);
    expect(usePadronStore.getState().pacientes).toHaveLength(0);
  });

  it("rejects non-integer ages on update with an edad message (B1)", () => {
    addPatient();
    const id = usePadronStore.getState().pacientes[0].id;
    expect(() => usePadronStore.getState().update(id, { edadMeses: 6.5 })).toThrow(/edad/i);
    expect(() => usePadronStore.getState().update(id, { edadMeses: NaN })).toThrow(/edad/i);
    expect(usePadronStore.getState().pacientes[0].edadMeses).toBe(24);
  });

  it("soft-deletes: remove keeps a dirty tombstone excluded from counts and average (B2)", () => {
    addPatient({ nivelHemoglobina: 12.0 });
    addPatient({ nombre: "Luis Paz", nivelHemoglobina: 6.5 });
    const id = usePadronStore.getState().pacientes[0].id;
    usePadronStore.getState().remove(id);

    const { pacientes } = usePadronStore.getState();
    expect(pacientes).toHaveLength(2);
    const tombstone = pacientes.find((p) => p.id === id)!;
    expect(tombstone.deletedAt).toEqual(expect.any(String));
    expect(tombstone.dirty).toBe(true);

    const visible = pacientes.filter((p) => !p.deletedAt);
    expect(visible).toHaveLength(1);
    expect(usePadronStore.getState().countByDiagnosis()).toMatchObject({
      Normal: 0,
      "Anemia Severa": 1,
    });
    expect(usePadronStore.getState().averageHb()).toBeCloseTo(6.5);
  });
  it("rejects the 101st record with a Spanish cap message", () => {
    for (let i = 0; i < MAX_PADRON; i += 1) {
      addPatient({ nombre: `Paciente ${i}`, nivelHemoglobina: 11.5 });
    }
    expect(usePadronStore.getState().pacientes).toHaveLength(100);
    expect(() => addPatient({ nombre: "Paciente 100" })).toThrow(/100/);
    expect(usePadronStore.getState().pacientes).toHaveLength(100);
  });

  it("frees visible capacity on soft-delete while keeping the tombstone (C1)", () => {
    for (let i = 0; i < MAX_PADRON; i += 1) {
      addPatient({ nombre: `Paciente ${i}`, nivelHemoglobina: 11.5 });
    }
    const deletedId = usePadronStore.getState().pacientes[0].id;
    usePadronStore.getState().remove(deletedId);

    addPatient({ nombre: "Paciente libre", nivelHemoglobina: 11.5 });

    const { pacientes } = usePadronStore.getState();
    expect(pacientes.filter((p) => !p.deletedAt)).toHaveLength(MAX_PADRON);
    expect(pacientes.find((p) => p.id === deletedId)?.deletedAt).toEqual(
      expect.any(String),
    );
    expect(() => addPatient({ nombre: "Paciente 101" })).toThrow(/100/);
    expect(
      usePadronStore.getState().pacientes.filter((p) => !p.deletedAt),
    ).toHaveLength(MAX_PADRON);
  });

  it("recomputes diagnosis when hemoglobin is updated", () => {
    addPatient({ nivelHemoglobina: 12.0 });
    const id = usePadronStore.getState().pacientes[0].id;
    usePadronStore.getState().update(id, { nivelHemoglobina: 8.0 });
    const updated = usePadronStore.getState().pacientes[0];
    expect(updated.diagnostico).toBe("Anemia Moderada");
    expect(updated.dirty).toBe(true);
  });

  it("reports counts per diagnosis and average hemoglobin", () => {
    addPatient({ nivelHemoglobina: 12.0 });
    addPatient({ nombre: "Luis Paz", nivelHemoglobina: 6.5 });
    const state = usePadronStore.getState();
    expect(state.countByDiagnosis()).toMatchObject({
      Normal: 1,
      "Anemia Severa": 1,
    });
    expect(state.averageHb()).toBeCloseTo(9.25);
  });

  it("persists the padron across restarts via localStorage", () => {
    addPatient({ nivelHemoglobina: 12.0 });
    const raw = localStorage.getItem("padron-storage");
    expect(raw).toContain("Ana Torres");
  });
});
