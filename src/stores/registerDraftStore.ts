import { create } from "zustand";
import { persist } from "zustand/middleware";

// Register draft: Nombre/Edad/Hb as typed, before submit.
// Jornada reality: interruptions (tab switches, reloads) must never eat a
// half-typed patient. Field values live here instead of RegisterForm
// useState so unmounting the form (tab switch) keeps the draft; zustand
// persist rehydrates it after a full reload, same pattern as
// padron-storage. Ephemeral UI (field errors, success announcer, duplicate
// warning) stays local to the form — only the three raw strings persist.
// User scoping: NONE, mirroring padron-storage (single "padron-storage"
// key with no user keying). Drafts are per-device localStorage, which
// matches PRODUCT offline-first (local padron is the source of truth;
// Supabase is a deferred replica). A second device never sees this draft.
export interface RegisterDraft {
  nombre: string;
  edad: string;
  hb: string;
}

interface RegisterDraftState extends RegisterDraft {
  setDraft: (patch: Partial<RegisterDraft>) => void;
  // Called on successful register submit: the draft is consumed, never replayed.
  clearDraft: () => void;
}

const EMPTY_DRAFT: RegisterDraft = { nombre: "", edad: "", hb: "" };

export const useRegisterDraftStore = create<RegisterDraftState>()(
  persist(
    (set) => ({
      ...EMPTY_DRAFT,
      setDraft: (patch) => set(patch),
      clearDraft: () => set({ ...EMPTY_DRAFT }),
    }),
    {
      name: "register-draft-storage",
      partialize: (state) => ({
        nombre: state.nombre,
        edad: state.edad,
        hb: state.hb,
      }),
    },
  ),
);
