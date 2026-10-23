import type { AiCoreState } from "@nexus/shared";

// Pure mapping – no Three.js imports, unit-testable for every state.
// Honest rule: audioLevel drives listening/speaking only; when 0 those states show no fake activity.

export interface CoreVisualParams {
  // 5 ring rotation speeds (rad/s)
  ringSpeeds: [number, number, number, number, number];
  // particle orbit speed multiplier
  particleSpeed: number;
  // 0..1
  glowIntensity: number;
  // hex
  color: string;
  amberMix: number; // 0..1 amber lerp for warning/awaiting
  redMix: number; // 0..1 red lerp for error
  pulse: number; // 0..1 inner core scale pulse amount
  spread: number; // ring scale spread
  progressVisible: boolean;
  waveformVisible: boolean;
  flicker: number; // 0..1 for error
}

export function coreParamsForState(state: AiCoreState, audioLevel: number): CoreVisualParams {
  const lvl = Math.max(0, Math.min(1, audioLevel));
  const baseCyan = "#00e5ff";
  const amber = "#ffb02e";
  const red = "#ff3b4a";

  // defaults for idle
  let ringSpeeds: [number, number, number, number, number] = [0.15, -0.12, 0.08, -0.06, 0.1];
  let particleSpeed = 0.2;
  let glowIntensity = 0.55;
  let color = baseCyan;
  let amberMix = 0;
  let redMix = 0;
  let pulse = 0.08;
  let spread = 1.0;
  let progressVisible = false;
  let waveformVisible = false;
  let flicker = 0;

  switch (state) {
    case "idle":
      glowIntensity = 0.55;
      particleSpeed = 0.2;
      pulse = 0.08;
      spread = 1.0;
      break;
    case "listening":
      // expanding rings + waveform ring driven by audioLevel; no fake activity when lvl=0
      glowIntensity = 0.7 + lvl * 0.3;
      particleSpeed = 0.25;
      pulse = 0.05 + lvl * 0.07;
      spread = 1.0 + lvl * 0.28;
      waveformVisible = true;
      // ring speeds slightly faster when lvl>0
      ringSpeeds = [0.22 + lvl * 0.2, -0.18 - lvl * 0.15, 0.12, -0.09, 0.15];
      break;
    case "thinking":
      glowIntensity = 0.85;
      particleSpeed = 1.4;
      pulse = 0.06;
      spread = 1.08;
      ringSpeeds = [0.45, -0.38, 0.32, -0.28, 0.4];
      break;
    case "executing":
      glowIntensity = 0.9;
      particleSpeed = 0.9;
      pulse = 0.04;
      spread = 1.06;
      progressVisible = true;
      ringSpeeds = [0.6, -0.45, 0.5, -0.35, 0.55];
      break;
    case "speaking":
      glowIntensity = 0.75 + lvl * 0.35;
      particleSpeed = 0.35 + lvl * 0.4;
      pulse = 0.07 + lvl * 0.18;
      spread = 1.0 + lvl * 0.22;
      waveformVisible = lvl > 0.02; // only show when real level
      ringSpeeds = [0.18 + lvl * 0.25, -0.15 - lvl * 0.2, 0.1, -0.08, 0.12];
      break;
    case "awaiting_approval":
      color = amber;
      amberMix = 1;
      glowIntensity = 0.95;
      particleSpeed = 0.15;
      pulse = 0.22; // amber pulse
      spread = 1.04;
      ringSpeeds = [0.12, -0.1, 0.08, -0.07, 0.1];
      break;
    case "warning":
      // amber highlights
      color = baseCyan;
      amberMix = 0.55;
      glowIntensity = 0.9;
      particleSpeed = 0.5;
      pulse = 0.12;
      spread = 1.07;
      ringSpeeds = [0.35, -0.3, 0.25, -0.2, 0.3];
      break;
    case "error":
      color = red;
      redMix = 1;
      glowIntensity = 1.0;
      particleSpeed = 0.6;
      pulse = 0.1;
      spread = 1.0;
      flicker = 0.5; // will be animated with time
      ringSpeeds = [0.3, -0.25, 0.2, -0.18, 0.22];
      break;
  }

  // Suppress for reduced effects caller will handle, but keep params honest
  // Ensure listening/speaking with lvl 0 do not show fake waveform intensity
  if ((state === "listening" || state === "speaking") && lvl < 0.015) {
    // keep waveformVisible for listening (so ring exists) but pulse low
    waveformVisible = state === "listening" ? true : false;
    // pulse already low for 0
  }

  return {
    ringSpeeds,
    particleSpeed,
    glowIntensity,
    color,
    amberMix,
    redMix,
    pulse,
    spread,
    progressVisible,
    waveformVisible,
    flicker,
  };
}
