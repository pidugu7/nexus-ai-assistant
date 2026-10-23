import { create } from "zustand";

export interface AppLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

interface LogState {
  entries: AppLogEntry[];
  collapsed: boolean;
  addEntry: (entry: AppLogEntry) => void;
  toggleCollapsed: () => void;
  setCollapsed: (v: boolean) => void;
}

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  collapsed: false,
  addEntry: (entry) => set((s) => ({ entries: [...s.entries, entry] })),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setCollapsed: (v) => set({ collapsed: v }),
}));
