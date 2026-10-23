import { create } from "zustand";

export const NAV_ITEMS = [
  "Home",
  "Projects",
  "Research",
  "Engineering",
  "Files",
  "Automation",
  "Memory",
  "Settings",
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

interface NavState {
  active: NavItem;
  setActive: (item: NavItem) => void;
}

export const useNavStore = create<NavState>((set) => ({
  active: "Home",
  setActive: (item) => set({ active: item }),
}));

// Pure helper for tests — validates nav item
export function isValidNavItem(value: string): value is NavItem {
  return (NAV_ITEMS as readonly string[]).includes(value);
}
