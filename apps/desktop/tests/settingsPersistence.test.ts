import { describe, it, expect, beforeEach } from "vitest";
import { persistReducedEffects, readReducedEffects } from "../src/renderer/src/store/settingsStore.js";
import { STORAGE_KEYS } from "../src/renderer/src/lib/storage.js";

describe("reduced-effects persistence", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore — storage may be mocked
    }
  });
  it("persists true and reads back", () => {
    persistReducedEffects(true);
    expect(readReducedEffects()).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.REDUCED_EFFECTS)!)).toBe(true);
  });
  it("persists false", () => {
    persistReducedEffects(false);
    expect(readReducedEffects()).toBe(false);
  });
  it("returns fallback when no value", () => {
    expect(readReducedEffects()).toBe(false);
  });
  it("guarded by try/catch — no throw when storage blocked", () => {
    const orig = globalThis.localStorage;
    // @ts-expect-error mock throwing storage
    globalThis.localStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      clear: () => { throw new Error("blocked"); },
    } as unknown as Storage;
    expect(() => persistReducedEffects(true)).not.toThrow();
    expect(readReducedEffects()).toBe(false);
    globalThis.localStorage = orig;
  });
});
