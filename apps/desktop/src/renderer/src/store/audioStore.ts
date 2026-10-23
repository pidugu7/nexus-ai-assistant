import { create } from "zustand";

interface AudioState {
  audioLevel: number; // 0-1, 0 until Phase 7
  isSimulated: boolean;
  setAudioLevel: (v: number, simulated?: boolean) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  audioLevel: 0,
  isSimulated: false,
  setAudioLevel: (v, simulated = false) => set({ audioLevel: Math.max(0, Math.min(1, v)), isSimulated: simulated }),
}));
