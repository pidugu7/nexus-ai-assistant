import { create } from "zustand";

export interface AppLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  source?: string;
  type?: string;
}

interface LogState {
  entries: AppLogEntry[];
  collapsed: boolean;
  addEntry: (entry: AppLogEntry) => void;
  setEntries: (entries: AppLogEntry[]) => void;
  clearView: () => void;
  toggleCollapsed: () => void;
  setCollapsed: (v: boolean) => void;
}

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  collapsed: false,
  addEntry: (entry) => set((s) => (s.entries.some((e) => e.id === entry.id) ? s : { entries: [...s.entries, entry] })),
  setEntries: (entries) => set({ entries }),
  clearView: () => set({ entries: [] }),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setCollapsed: (v) => set({ collapsed: v }),
}));
