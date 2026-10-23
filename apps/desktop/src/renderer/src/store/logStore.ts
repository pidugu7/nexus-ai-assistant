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

const MAX_IN_MEMORY = 200;

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  collapsed: false,
  addEntry: (entry) =>
    set((s) => {
      if (s.entries.some((e) => e.id === entry.id)) return s;
      const next = [...s.entries, entry];
      // Keep newest 200, drop oldest (slice(-200)), not first 200
      const trimmed = next.length > MAX_IN_MEMORY ? next.slice(-MAX_IN_MEMORY) : next;
      return { entries: trimmed };
    }),
  setEntries: (entries) =>
    set({
      entries: entries.length > MAX_IN_MEMORY ? entries.slice(-MAX_IN_MEMORY) : entries,
    }),
  clearView: () => set({ entries: [] }),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setCollapsed: (v) => set({ collapsed: v }),
}));
