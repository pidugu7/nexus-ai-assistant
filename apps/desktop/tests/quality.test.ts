import { describe, it, expect } from "vitest";
import { resolveQualityTier, QUALITY_CONFIG } from "../src/renderer/src/core/useQuality.js";

describe("quality tier selection", () => {
  it("reduced effects forces low", () => {
    expect(resolveQualityTier({ manual: "high", reducedEffects: true, batteryDischarging: false })).toBe("low");
    expect(resolveQualityTier({ manual: "medium", reducedEffects: true, batteryDischarging: null })).toBe("low");
  });

  it("battery discharging forces low", () => {
    expect(resolveQualityTier({ manual: "high", reducedEffects: false, batteryDischarging: true })).toBe("low");
    expect(resolveQualityTier({ manual: "high", reducedEffects: false, batteryDischarging: false })).toBe("high");
  });

  it("unavailable battery API falls back to manual", () => {
    expect(resolveQualityTier({ manual: "high", reducedEffects: false, batteryDischarging: null })).toBe("high");
    expect(resolveQualityTier({ manual: "medium", reducedEffects: false, batteryDischarging: null })).toBe("medium");
  });

  it("manual low stays low", () => {
    expect(resolveQualityTier({ manual: "low", reducedEffects: false, batteryDischarging: false })).toBe("low");
  });

  it("quality config has correct particle counts and bloom", () => {
    expect(QUALITY_CONFIG.high.particleCount).toBe(1100);
    expect(QUALITY_CONFIG.medium.particleCount).toBe(500);
    expect(QUALITY_CONFIG.low.particleCount).toBe(120);
    expect(QUALITY_CONFIG.low.enableBloom).toBe(false);
    expect(QUALITY_CONFIG.high.enableBloom).toBe(true);
  });
});
