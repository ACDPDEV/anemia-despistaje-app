import { create } from "zustand";
import { persist } from "zustand/middleware";
import { evaluatePatient, type Diagnosis } from "../domain/anemia";
import { normalizeNombre } from "../lib/normalize";

// App invariant: the local padron never holds more than 100 records.
// The 101st registration is rejected with a Spanish message.
export const MAX_PADRON = 100;

// Severity queue rank: lower runs first when "moderados y severos primero" is active.
export const SEVERITY_RANK: Record<Diagnosis, number> = {
  "Anemia Severa": 0,
  "Anemia Moderada": 1,
  "Anemia Leve": 2,
  Normal: 3,
};

// Sorted copy by severity, stable by input index. Never mutates the input.
export function bySeverity(list: Paciente[]): Paciente[] {
  return [...list]
    .map((p, index) => ({ p, index }))
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.p.diagnostico] - SEVERITY_RANK[b.p.diagnostico] ||
        a.index - b.index,
    )
    .map(({ p }) => p);
}

// Warning-only duplicate signal: exact normalized-name matches among
// visible rows. Tombstones (deletedAt set) never surface as duplicates.
export function findPossibleDuplicates(nombre: string): Paciente[] {
  const target = normalizeNombre(nombre);
  if (target.length === 0) return [];
  return usePadronStore
    .getState()
    .pacientes.filter((p) => !p.deletedAt && normalizeNombre(p.nombre) === target);
}

export interface Paciente {
  id: string;
  nombre: string;
  edadMeses: number;
  nivelHemoglobina: number;
  diagnostico: Diagnosis;
  updatedAt: string;
  dirty: boolean;
  deletedAt?: string | null;
}

export type NewPaciente = Pick<Paciente, "nombre" | "edadMeses" | "nivelHemoglobina">;

interface PadronState {
  pacientes: Paciente[];
  add: (input: NewPaciente) => void;
  update: (id: string, patch: Partial<NewPaciente>) => void;
  remove: (id: string) => void;
  // Undo for a tombstone soft-delete: clears deletedAt so the row is
  // visible again. Marked dirty so the next push replicates the revival
  // (deleted_at null wins by newer updatedAt). Local-only otherwise.
  restore: (id: string) => void;
  // Marks pushed rows clean after a successful pushDirty (pushedIds come
  // straight from the push outcome). Tombstone GC stays separate in
  // purgeSyncedTombstones: call it after this so replicated deletes drop.
  markSynced: (ids: string[]) => void;
  // Replaces the padron with a guardedPull merge result (mergePacientes
  // output). No validation: the merge already preserves local order and
  // recomputes diagnostico from hemoglobin.
  applyPullMerge: (merged: Paciente[]) => void;
  // GC for pushed deletes: drops ONLY tombstones already replicated
  // (deletedAt set AND dirty=false). Dirty tombstones are still queued
  // for the next push and must survive.
  purgeSyncedTombstones: () => void;
  countByDiagnosis: () => Record<Diagnosis, number>;
  averageHb: () => number;
  reset: () => void;
}

function generateId(): string {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUUID) return randomUUID();
  return `p-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function validateInput(input: NewPaciente): void {
  if (!input.nombre || input.nombre.trim().length === 0) {
    throw new Error("El nombre del paciente es obligatorio.");
  }
  if (!Number.isInteger(input.edadMeses)) {
    throw new Error("La edad debe estar entre 6 y 59 meses.");
  }
  if (input.edadMeses < 6 || input.edadMeses > 59) {
    throw new Error("La edad debe estar entre 6 y 59 meses.");
  }
  if (!Number.isFinite(input.nivelHemoglobina) || input.nivelHemoglobina <= 0) {
    throw new Error("El nivel de hemoglobina debe ser mayor que 0.");
  }
}

function emptyCounts(): Record<Diagnosis, number> {
  return { Normal: 0, "Anemia Leve": 0, "Anemia Moderada": 0, "Anemia Severa": 0 };
}

export const usePadronStore = create<PadronState>()(
  persist(
    (set, get) => ({
      pacientes: [],

      add: (input) =>
        set((state) => {
          validateInput(input);
          if (state.pacientes.filter((p) => !p.deletedAt).length >= MAX_PADRON) {
            throw new Error(`El padrón está lleno (máximo ${MAX_PADRON} pacientes).`);
          }
          const paciente: Paciente = {
            id: generateId(),
            nombre: input.nombre.trim(),
            edadMeses: input.edadMeses,
            nivelHemoglobina: input.nivelHemoglobina,
            diagnostico: evaluatePatient(input.nivelHemoglobina),
            updatedAt: new Date().toISOString(),
            dirty: true,
            deletedAt: null,
          };
          return { pacientes: [...state.pacientes, paciente] };
        }),

      update: (id, patch) =>
        set((state) => ({
          pacientes: state.pacientes.map((p) => {
            if (p.id !== id) return p;
            const next: Paciente = { ...p, ...patch };
            if (patch.nombre !== undefined) next.nombre = patch.nombre.trim();
            validateInput({
              nombre: next.nombre,
              edadMeses: next.edadMeses,
              nivelHemoglobina: next.nivelHemoglobina,
            });
            if (patch.nivelHemoglobina !== undefined) {
              next.diagnostico = evaluatePatient(patch.nivelHemoglobina);
            }
            next.updatedAt = new Date().toISOString();
            next.dirty = true;
            return next;
          }),
        })),

      remove: (id) =>
        set((state) => ({
          pacientes: state.pacientes.map((p) => {
            if (p.id !== id) return p;
            const now = new Date().toISOString();
            return { ...p, deletedAt: now, updatedAt: now, dirty: true };
          }),
        })),

      purgeSyncedTombstones: () =>
        set((state) => ({
          pacientes: state.pacientes.filter((p) => !(p.deletedAt && !p.dirty)),
        })),

      restore: (id) =>
        set((state) => ({
          pacientes: state.pacientes.map((p) => {
            if (p.id !== id || !p.deletedAt) return p;
            const now = new Date().toISOString();
            return { ...p, deletedAt: null, updatedAt: now, dirty: true };
          }),
        })),

      markSynced: (ids) =>
        set((state) => {
          const pushed = new Set(ids);
          return {
            pacientes: state.pacientes.map((p) =>
              pushed.has(p.id) ? { ...p, dirty: false } : p,
            ),
          };
        }),

      applyPullMerge: (merged) => set({ pacientes: merged }),

      countByDiagnosis: () => {
        const counts = emptyCounts();
        for (const p of get().pacientes) {
          if (p.deletedAt) continue;
          counts[p.diagnostico] += 1;
        }
        return counts;
      },

      averageHb: () => {
        const visible = get().pacientes.filter((p) => !p.deletedAt);
        if (visible.length === 0) return 0;
        const sum = visible.reduce((acc, p) => acc + p.nivelHemoglobina, 0);
        return sum / visible.length;
      },

      reset: () => set({ pacientes: [] }),
    }),
    {
      name: "padron-storage",
      partialize: (state) => ({ pacientes: state.pacientes }),
    },
  ),
);
