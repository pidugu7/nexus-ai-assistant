import { create } from "zustand";
import { STORAGE_KEYS, getStored, setStored } from "../lib/storage.js";

interface SettingsState {
  reducedEffects: boolean;
  setReducedEffects: (v: boolean) => void;
  toggleReducedEffects: () => void;
}

function loadReduced(): boolean {
  return getStored<boolean>(STORAGE_KEYS.REDUCED_EFFECTS, false);
}

export const useSettingsStore = create<SettingsState>((set) => ({
  reducedEffects: loadReduced(),
  setReducedEffects: (v) => {
    setStored(STORAGE_KEYS.REDUCED_EFFECTS, v);
    set({ reducedEffects: v });
  },
  toggleReducedEffects: () =>
    set((s) => {
      const next = !s.reducedEffects;
      setStored(STORAGE_KEYS.REDUCED_EFFECTS, next);
      return { reducedEffects: next };
    }),
}));

// For tests — pure persistence helpers
export function persistReducedEffects(value: boolean): void {
  setStored(STORAGE_KEYS.REDUCED_EFFECTS, value);
}
export function readReducedEffects(): boolean {
  return getStored<boolean>(STORAGE_KEYS.REDUCED_EFFECTS, false);
}
