import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_NOMBRE,
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

  it("rejects non-integer and NaN ages with an edad message (B1)", () => {
    expect(() => addPatient({ edadMeses: 6.5 })).toThrow(/edad/i);
    expect(() => addPatient({ edadMeses: NaN })).toThrow(/edad/i);
    expect(usePadronStore.getState().pacientes).toHaveLength(0);
  });

  it("caps nombre at MAX_NOMBRE (120) with a Spanish message on add and update", () => {
    expect(MAX_NOMBRE).toBe(120);
    expect(() => addPatient({ nombre: "A".repeat(121) })).toThrow(
      /exceder 120 caracteres/i,
    );
    expect(usePadronStore.getState().pacientes).toHaveLength(0);
    // Boundary: exactly 120 registers.
    addPatient({ nombre: "A".repeat(120) });
    expect(usePadronStore.getState().pacientes).toHaveLength(1);
    const id = usePadronStore.getState().pacientes[0].id;
    expect(() =>
      usePadronStore.getState().update(id, { nombre: "B".repeat(121) }),
    ).toThrow(/exceder 120 caracteres/i);
    expect(usePadronStore.getState().pacientes[0].nombre).toBe("A".repeat(120));
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

  it("restores a tombstone: restore clears deletedAt and requeues a dirty push", () => {
    addPatient({ nivelHemoglobina: 12.0 });
    const id = usePadronStore.getState().pacientes[0].id;
    usePadronStore.getState().remove(id);
    expect(
      usePadronStore.getState().pacientes.find((p) => p.id === id)?.deletedAt,
    ).toEqual(expect.any(String));
    usePadronStore.getState().restore(id);
    const restored = usePadronStore
      .getState()
      .pacientes.find((p) => p.id === id)!;
    expect(restored.deletedAt).toBeNull();
    expect(restored.dirty).toBe(true);
    expect(
      usePadronStore.getState().pacientes.filter((p) => !p.deletedAt),
    ).toHaveLength(1);
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

  it("excludes tombstones from duplicate signals (B2)", () => {
    addPatient({ nombre: "Borrado Uno", nivelHemoglobina: 12.0 });
    const id = usePadronStore.getState().pacientes[0].id;
    usePadronStore.getState().remove(id);
    expect(findPossibleDuplicates("Borrado Uno")).toHaveLength(0);
  });

  describe("purgeSyncedTombstones (GC)", () => {
    function setupTombstones() {
      const preexisting = new Set(usePadronStore.getState().pacientes.map((p) => p.id));
      addPatient({ nombre: "Limpio", nivelHemoglobina: 12.0 });
      addPatient({ nombre: "Sucio", nivelHemoglobina: 11.0 });
      const [cleanId, dirtyId] = usePadronStore
        .getState()
        .pacientes.map((p) => p.id)
        .filter((id) => !preexisting.has(id));
      usePadronStore.getState().remove(cleanId);
      usePadronStore.getState().remove(dirtyId);
      // Simulate a successful push of the first delete: clean tombstone.
      usePadronStore.setState((state) => ({
        pacientes: state.pacientes.map((p) =>
          p.id === cleanId ? { ...p, dirty: false } : p,
        ),
      }));
      return { cleanId, dirtyId };
    }

    it("purges clean tombstones (deletedAt set AND dirty=false)", () => {
      const { cleanId } = setupTombstones();
      usePadronStore.getState().purgeSyncedTombstones();
      const { pacientes } = usePadronStore.getState();
      expect(pacientes.find((p) => p.id === cleanId)).toBeUndefined();
    });

    it("keeps dirty tombstones (deletedAt set but still queued for push)", () => {
      const { dirtyId } = setupTombstones();
      usePadronStore.getState().purgeSyncedTombstones();
      const tombstone = usePadronStore.getState().pacientes.find((p) => p.id === dirtyId)!;
      expect(tombstone.deletedAt).toEqual(expect.any(String));
      expect(tombstone.dirty).toBe(true);
    });

    it("leaves visible rows and their selectors untouched", () => {
      addPatient({ nombre: "Visible", nivelHemoglobina: 12.5 });
      const visibleId = usePadronStore.getState().pacientes[0].id;
      setupTombstones();
      const before = usePadronStore
        .getState()
        .pacientes.filter((p) => !p.deletedAt)
        .map((p) => p.id);
      usePadronStore.getState().purgeSyncedTombstones();
      const state = usePadronStore.getState();
      const visible = state.pacientes.find((p) => p.id === visibleId)!;
      expect(visible.nombre).toBe("Visible");
      expect(visible.deletedAt).toBeNull();
      expect(state.pacientes.filter((p) => !p.deletedAt).map((p) => p.id)).toEqual(before);
      expect(state.averageHb()).toBeCloseTo(
        before.reduce(
          (acc, id) => acc + state.pacientes.find((p) => p.id === id)!.nivelHemoglobina,
          0,
        ) / before.length,
      );
    });
  });
});
