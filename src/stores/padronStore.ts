import { create } from "zustand";
import { persist } from "zustand/middleware";
import { evaluatePatient, type Diagnosis } from "../domain/anemia";

// App invariant: the local padron never holds more than 100 records.
// The 101st registration is rejected with a Spanish message.
export const MAX_PADRON = 100;

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
  if (!Number.isInteger(input.edadMeses) && !(typeof input.edadMeses === "number")) {
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
          if (state.pacientes.length >= MAX_PADRON) {
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
          pacientes: state.pacientes.filter((p) => p.id !== id),
        })),

      countByDiagnosis: () => {
        const counts = emptyCounts();
        for (const p of get().pacientes) counts[p.diagnostico] += 1;
        return counts;
      },

      averageHb: () => {
        const { pacientes } = get();
        if (pacientes.length === 0) return 0;
        const sum = pacientes.reduce((acc, p) => acc + p.nivelHemoglobina, 0);
        return sum / pacientes.length;
      },

      reset: () => set({ pacientes: [] }),
    }),
    {
      name: "padron-storage",
      partialize: (state) => ({ pacientes: state.pacientes }),
    },
  ),
);
