import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_PADRON,
  bySeverity,
  findPossibleDuplicates,
  SEVERITY_RANK,
  usePadronStore,
} from "./padronStore";

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

  it("rejects the 101st record with a Spanish cap message", () => {
    for (let i = 0; i < MAX_PADRON; i += 1) {
      addPatient({ nombre: `Paciente ${i}`, nivelHemoglobina: 11.5 });
    }
    expect(usePadronStore.getState().pacientes).toHaveLength(100);
    expect(() => addPatient({ nombre: "Paciente 100" })).toThrow(/100/);
    expect(usePadronStore.getState().pacientes).toHaveLength(100);
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

  it("ranks severity Severa before Moderada before Leve before Normal", () => {
    expect(SEVERITY_RANK["Anemia Severa"]).toBeLessThan(
      SEVERITY_RANK["Anemia Moderada"],
    );
    expect(SEVERITY_RANK["Anemia Moderada"]).toBeLessThan(
      SEVERITY_RANK["Anemia Leve"],
    );
    expect(SEVERITY_RANK["Anemia Leve"]).toBeLessThan(SEVERITY_RANK["Normal"]);
  });

  it("sorts a copy by severity without mutating the input", () => {
    addPatient({ nombre: "Normal Uno", nivelHemoglobina: 12.0 });
    addPatient({ nombre: "Severa Uno", nivelHemoglobina: 6.5 });
    addPatient({ nombre: "Leve Uno", nivelHemoglobina: 10.5 });
    const input = usePadronStore.getState().pacientes;
    const before = input.map((p) => p.nombre);
    const sorted = bySeverity(input);
    expect(sorted.map((p) => p.nombre)).toEqual([
      "Severa Uno",
      "Leve Uno",
      "Normal Uno",
    ]);
    expect(sorted).not.toBe(input);
    expect(input.map((p) => p.nombre)).toEqual(before);
  });

  it("keeps registration order within the same severity band", () => {
    addPatient({ nombre: "Severa A", nivelHemoglobina: 6.5 });
    addPatient({ nombre: "Normal Inter", nivelHemoglobina: 12.0 });
    addPatient({ nombre: "Severa B", nivelHemoglobina: 6.0 });
    const sorted = bySeverity(usePadronStore.getState().pacientes);
    expect(sorted.map((p) => p.nombre)).toEqual([
      "Severa A",
      "Severa B",
      "Normal Inter",
    ]);
  });

  it("flags exact normalized matches including accents", () => {
    addPatient({ nombre: "María López", nivelHemoglobina: 12.0 });
    expect(findPossibleDuplicates(" maria  lopez ")).toHaveLength(1);
    expect(findPossibleDuplicates("Jose")).toHaveLength(0);
    addPatient({ nombre: "José", nivelHemoglobina: 12.0 });
    const dups = findPossibleDuplicates("Jose");
    expect(dups).toHaveLength(1);
    expect(dups[0].nombre).toBe("José");
  });

  it("stays silent for different names", () => {
    addPatient({ nombre: "Ana Ruiz", nivelHemoglobina: 12.0 });
    expect(findPossibleDuplicates("Ana Torres")).toHaveLength(0);
  });
});
