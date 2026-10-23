import { describe, it, expect } from "vitest";
import { coreParamsForState } from "../src/renderer/src/core/coreParamsForState.js";

describe("coreParamsForState", () => {
  const states = ["idle", "listening", "thinking", "executing", "speaking", "awaiting_approval", "warning", "error"] as const;
  for (const s of states) {
    it(`has mapping for ${s}`, () => {
      const p = coreParamsForState(s, 0);
      expect(p.ringSpeeds).toHaveLength(5);
      expect(typeof p.particleSpeed).toBe("number");
      expect(typeof p.glowIntensity).toBe("number");
      expect(typeof p.color).toBe("string");
      expect(typeof p.pulse).toBe("number");
      expect(typeof p.spread).toBe("number");
      expect(typeof p.progressVisible).toBe("boolean");
      expect(typeof p.waveformVisible).toBe("boolean");
    });
  }

  it("idle is dim cyan, slow", () => {
    const p = coreParamsForState("idle", 0);
    expect(p.glowIntensity).toBe(0.55);
    expect(p.particleSpeed).toBe(0.2);
    expect(p.color).toBe("#00e5ff");
    expect(p.progressVisible).toBe(false);
  });

  it("listening with 0 shows no fake activity (low pulse, waveform ring exists but low glow)", () => {
    const p0 = coreParamsForState("listening", 0);
    const p1 = coreParamsForState("listening", 0.8);
    expect(p0.waveformVisible).toBe(true);
    expect(p0.glowIntensity).toBeLessThan(p1.glowIntensity);
    expect(p0.pulse).toBeLessThan(p1.pulse);
    // with 0, pulse minimal
    expect(p0.pulse).toBeCloseTo(0.05, 1);
  });

  it("speaking with 0 shows no waveform pulse", () => {
    const p0 = coreParamsForState("speaking", 0);
    const p1 = coreParamsForState("speaking", 0.9);
    expect(p0.waveformVisible).toBe(false);
    expect(p1.waveformVisible).toBe(true);
    expect(p0.pulse).toBeLessThan(p1.pulse);
    expect(p0.glowIntensity).toBeLessThan(p1.glowIntensity);
  });

  it("thinking has faster particles", () => {
    const idle = coreParamsForState("idle", 0);
    const thinking = coreParamsForState("thinking", 0);
    expect(thinking.particleSpeed).toBeGreaterThan(idle.particleSpeed);
  });

  it("executing shows progress ring", () => {
    expect(coreParamsForState("executing", 0).progressVisible).toBe(true);
    expect(coreParamsForState("idle", 0).progressVisible).toBe(false);
  });

  it("awaiting_approval is amber", () => {
    const p = coreParamsForState("awaiting_approval", 0);
    expect(p.amberMix).toBe(1);
    expect(p.color).toBe("#ffb02e");
  });

  it("warning has amber highlights", () => {
    const p = coreParamsForState("warning", 0);
    expect(p.amberMix).toBe(0.55);
  });

  it("error is red flicker", () => {
    const p = coreParamsForState("error", 0);
    expect(p.redMix).toBe(1);
    expect(p.color).toBe("#ff3b4a");
    expect(p.flicker).toBeGreaterThan(0);
  });

  it("all states look visibly different (glow or speed differs)", () => {
    const params = states.map((s) => coreParamsForState(s, 0.5));
    const glows = params.map((p) => p.glowIntensity);
    // at least 3 distinct glows
    expect(new Set(glows).size).toBeGreaterThan(3);
  });
});
