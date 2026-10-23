import { create } from "zustand";
import { STORAGE_KEYS, setStored } from "../lib/storage.js";

function getSystemPrefersReduced(): boolean {
  try {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  } catch {
    // ignore
  }
  return false;
}

function initialStored(): boolean | null {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEYS.REDUCED_EFFECTS);
      if (raw === null) return false; // default OFF
      return JSON.parse(raw) as boolean | null;
    }
  } catch {
    return false;
  }
  return false;
}

interface SettingsState {
  storedValue: boolean | null; // null = follow system, true/false = explicit, default false when no key
  systemPrefersReduced: boolean;
  effectiveReduced: boolean;
  reducedSource: "default" | "stored" | "system";
  reducedEffects: boolean; // alias for effectiveReduced for compat
  setReducedEffects: (v: boolean) => void;
  setFollowSystem: (follow: boolean) => void;
  toggleReducedEffects: () => void;
  refreshSystemPrefers: () => void;
  fpsOverlay: boolean;
  setFpsOverlay: (v: boolean) => void;
  toggleFpsOverlay: () => void;
}

function makeEffectiveAndSource(stored: boolean | null, systemPrefers: boolean) {
  const effective = stored === null ? systemPrefers : stored;
  const source = stored === null ? "system" : (() => {
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEYS.REDUCED_EFFECTS) === null) return "default" as const;
    } catch {
      return "default" as const;
    }
    return "stored" as const;
  })();
  return { effective, source };
}

function getInitialFps(): boolean {
  try {
    const raw = localStorage.getItem("nexus:fps-overlay");
    if (raw !== null) return JSON.parse(raw) as boolean;
  } catch {
    // ignore
  }
  return false;
}

const initStored = initialStored();
const initSystem = getSystemPrefersReduced();
const initComputed = makeEffectiveAndSource(initStored, initSystem);
const initFps = getInitialFps();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  storedValue: initStored,
  systemPrefersReduced: initSystem,
  effectiveReduced: initComputed.effective,
  reducedSource: initComputed.source,
  reducedEffects: initComputed.effective,
  fpsOverlay: initFps,
  setReducedEffects: (v) => {
    setStored(STORAGE_KEYS.REDUCED_EFFECTS, v);
    const system = get().systemPrefersReduced;
    set({ storedValue: v, effectiveReduced: v, reducedEffects: v, reducedSource: "stored" });
    // keep systemPrefers for info
    void system;
  },
  setFollowSystem: (follow) => {
    if (follow) {
      setStored(STORAGE_KEYS.REDUCED_EFFECTS, null);
      const system = getSystemPrefersReduced();
      set({ storedValue: null, systemPrefersReduced: system, effectiveReduced: system, reducedEffects: system, reducedSource: "system" });
    } else {
      // when unfollowing, set to current effective as explicit
      const cur = get().effectiveReduced;
      setStored(STORAGE_KEYS.REDUCED_EFFECTS, cur);
      set({ storedValue: cur, effectiveReduced: cur, reducedEffects: cur, reducedSource: "stored" });
    }
  },
  toggleReducedEffects: () =>
    set((s) => {
      // if following system, toggle should set explicit to !effective and break follow
      const next = !s.effectiveReduced;
      setStored(STORAGE_KEYS.REDUCED_EFFECTS, next);
      return { storedValue: next, effectiveReduced: next, reducedEffects: next, reducedSource: "stored" as const };
    }),
  refreshSystemPrefers: () => {
    const system = getSystemPrefersReduced();
    const stored = get().storedValue;
    if (stored === null) {
      set({ systemPrefersReduced: system, effectiveReduced: system, reducedEffects: system });
    } else {
      set({ systemPrefersReduced: system });
    }
  },
  setFpsOverlay: (v) => {
    try {
      localStorage.setItem("nexus:fps-overlay", JSON.stringify(v));
    } catch {
      // ignore
    }
    set({ fpsOverlay: v });
  },
  toggleFpsOverlay: () =>
    set((s) => {
      const next = !s.fpsOverlay;
      try {
        localStorage.setItem("nexus:fps-overlay", JSON.stringify(next));
      } catch {
        // ignore
      }
      return { fpsOverlay: next };
    }),
}));

// Listen to OS preference changes when following system
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  try {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => {
      useSettingsStore.getState().refreshSystemPrefers();
    };
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler);
    } else if (typeof (mq as unknown as { addListener: (cb: () => void) => void }).addListener === "function") {
      (mq as unknown as { addListener: (cb: () => void) => void }).addListener(handler);
    }
  } catch {
    // ignore
  }
}

// For tests — pure persistence helpers (keep compat)
export function persistReducedEffects(value: boolean | null): void {
  setStored(STORAGE_KEYS.REDUCED_EFFECTS, value);
  // also update store if exists
  try {
    const system = getSystemPrefersReduced();
    const effective = value === null ? system : !!value;
    const source = value === null ? "system" : "stored";
    // update store state to reflect persisted value for test determinism
    useSettingsStore.setState({
      storedValue: value === null ? null : !!value,
      systemPrefersReduced: system,
      effectiveReduced: effective,
      reducedEffects: effective,
      reducedSource: source as SettingsState["reducedSource"],
    });
  } catch {
    // ignore
  }
}
export function readReducedEffects(): boolean | null {
  // return stored boolean or null for follow-system, fallback false when no key
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEYS.REDUCED_EFFECTS);
      if (raw === null) return false;
      return JSON.parse(raw) as boolean | null;
    }
  } catch {
    return false;
  }
  return false;
}
export function getReducedSource(): { effective: boolean; source: "default" | "stored" | "system"; stored: boolean | null; systemPrefers: boolean } {
  const s = useSettingsStore.getState();
  return { effective: s.effectiveReduced, source: s.reducedSource, stored: s.storedValue, systemPrefers: s.systemPrefersReduced };
}
export function getSystemPrefersReducedValue(): boolean {
  return getSystemPrefersReduced();
}
