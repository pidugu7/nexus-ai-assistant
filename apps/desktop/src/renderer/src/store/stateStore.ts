import { create } from "zustand";
import type { AiCoreState } from "@nexus/shared";

interface StateStore {
  state: AiCoreState;
  setState: (s: AiCoreState) => void;
}

export const useStateStore = create<StateStore>((set) => ({
  state: "idle",
  setState: (s) => set({ state: s }),
}));
