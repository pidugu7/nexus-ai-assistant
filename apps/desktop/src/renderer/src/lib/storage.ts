/**
 * Safe localStorage wrapper — guarded by try/catch per spec.
 * Returns null on failure (e.g., sandboxed, quota exceeded).
 */
export function getStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore — persistence is best-effort
  }
}

export const STORAGE_KEYS = {
  REDUCED_EFFECTS: "nexus:reduced-effects",
  QUALITY: "nexus:quality",
  FPS_OVERLAY: "nexus:fps-overlay",
  OLLAMA_MODEL: "nexus:ollama-model",
  SHOW_REASONING: "nexus:show-reasoning",
  FAST_MODE: "nexus:fast-mode",
} as const;
