# NEXUS AI — 3D Core (Phase 3)

Procedural cinematic core driven ONLY by real `state` + `audioLevel` (0 until Phase 7). No LLM/voice/tools.

## State → Visual mapping — `coreParamsForState(state, audioLevel)` (pure, no Three)

| State | Rings | Particles | Glow | Color | Pulse | Spread | Progress | Waveform | Notes |
|---|---|---|---|---|---|---|---:|---|---:|---|
| `idle` | slow 0.15/-0.12 | 0.2 | 0.55 | cyan | 0.08 gentle breathing | 1.0 | hidden | hidden | dim, slow |
| `listening` | 0.22+0.2·lvl expand outward, brighter | 0.25 | 0.70+0.30·lvl | cyan | 0.05+0.07·lvl | 1+0.28·lvl | hidden | visible (lvl drives scale, 0 = minimal glow) | rings expand, brighter cyan |
| `thinking` | fast 0.45/-0.38 counter-rotate | 1.4 fast orbit | 0.85 | cyan | 0.06 | 1.08 | hidden | hidden | particles fast, rings counter |
| `executing` | 0.60/-0.45 fast | 0.9 | 0.90 | cyan | 0.04 | 1.06 | **visible** segmented progress + white-cyan highlight | hidden | rotating arc |
| `speaking` | 0.18+0.25·lvl | 0.35+0.40·lvl | 0.75+0.35·lvl | cyan | 0.07+0.18·lvl | 1+0.22·lvl | hidden | visible only if lvl>0.02 | pulse driven by audio only, 0 = no fake |
| `awaiting_approval` | slow 0.12 | 0.15 | 0.95 | **amber** | 0.22 slow pulse | 1.04 | hidden | hidden | amber slow pulse |
| `warning` | 0.35/-0.30 | 0.5 | 0.90 | cyan→amber 0.55 | 0.12 | 1.07 | hidden | hidden | amber highlights |
| `error` | 0.30/-0.25 | 0.6 | 1.0 | **red** | 0.10 | 1.0 | hidden | hidden | red flicker then settle, no flicker when Reduced |

All params `THREE.MathUtils.damp(target, 3-6, dt)` with `dt = min(delta,0.1)` so hidden→visible never jumps.

## Scene graph — `apps/desktop/src/renderer/src/core/CoreScene.tsx`

- `<Canvas frameloop={paused?"never":"always"} dpr={tier.dpr}>` + `fog(#04070a,6.5,13.5)`
- **Radial glow behind core** – `Sprite` with procedural `CanvasTexture` radial gradient (canvas, no external asset) at `z=-1.8`, AdditiveBlending, scale/pulse with glowIntensity
- Wireframe `SphereGeometry(0.82,32)` subtle (`opacity 0.32 emissive 0.22`), inner `Icosahedron(0.38,2)` bright emissive 1.35-2.1 pulsing
- 5 `TorusGeometry` main rings (tori 1.02-1.58, tube 0.018+glow*0.01, 96 segments) emissive 1.55×glow → blooms
- 3 thin faint outer rings at 1.92/2.08/2.22 radius opacity 0.08-0.14 (depth cue)
- `InstancedMesh` particles (`Sphere 0.06`) count by tier; `InstancedMesh` dust 45/90 slow-drift `Sphere 0.5` opacity 0.09 (keeps draw calls low: 1 particles +1 dust)
- `RingGeometry` waveform (listening/speaking) scaled by audioLevel, `RingGeometry` progress (executing) 1.42π arc + white highlight
- `gridHelper(10,20)` floor, `ambientLight 0.55`, 2 `pointLight` tinted by state color (intensity 1.45/0.65)
- Post: `EffectComposer > Bloom(luminanceThreshold 0.32 high /0.42 medium, intensity 1.55/1.0, radius 0.82/0.65, mipmapBlur) + Vignette(offset0.24,darkness0.58)` – `low` disables bloom, wireframe stays subtle due to low emissive
- Colors from tokens `--cyan #00e5ff`, `--amber #ffb02e`, `--red #ff3b4a`

## Quality tiers — `useQuality.ts`

| Tier | Particles + Dust | Bloom | DPR | When |
|---|---|---|---|---|
| high | 1100 +90 dust, Bloom 1.55/0.82 thresh0.32 | enabled, clearly visible on rings/particles/inner core | 1.5 | default (bright, cinematic) |
| medium | 500 +45 dust, Bloom 1.0/0.65 thresh0.42 | enabled lighter | 1.1 | manual |
| low | 120 no dust, no bloom | disabled | 1 | Reduced ON or battery discharging |

Settings `select` persists `nexus:quality`; Reduced forces low via `resolveQualityTier({manual,reduced,batteryDischarging})`; low/medium visibly lighter (fewer particles, no/lower bloom, lower DPR).

## Performance & lifecycle

- Pause: `document.hidden`, `window blur/focus`, `frameloop="never"`; cap delta 0.1 after hidden
- Dispose: `gl.dispose()`, `geometry.dispose()`, `material.dispose()` on `onCreated` cleanup and `useEffect` unmount; remove `webglcontextlost`, `visibilitychange`, `battery chargingchange` listeners; no growth on 10 min walk
- Reduced: `data-reduced="true"` disables bloom/flicker (WireSphere flicker 0, InnerCore pulse capped 0.08, particles speed capped 0.45), `duration 0` transitions

## Fallbacks

- `Canvas onError` or `canvas.addEventListener("webglcontextlost",…)` → `setWebglFailed/contextLost` → `<FallbackCore state reason>` (SVG 3 circles + state label), `logStore.addEntry` warn `core.fallback`, keep app usable
- `CoreErrorBoundary` catches render errors → fallback + log

## FPS & debug overlay

- Toggle: `Ctrl+Alt+Shift+F` via main `before-input-event input.code==="KeyF"` → `NEXUS_IPC.FPS_TOGGLE` → `window.nexus.fps.onToggle` → `settingsStore.toggleFpsOverlay()` + Settings switch `data-testid="fps-toggle"` (default off)
- Measures real: `requestAnimationFrame` 500 ms window → FPS, `gl.info.render.calls` → draw calls, `settings.particleCount`, tier, state; `FpsOverlay` shown only when enabled (and not when Reduced)

## Accessibility & honesty

- `aria-live="polite"` label `State: THINKING` (`data-testid="core-state-label"`) near canvas, unchanged
- Reduced removes flicker/strong pulsing (error flicker gated)
- Honest: `audioLevel` from `audioStore` default 0; dev-only slider `SIMULATED audio level` sets it and shows `SIMULATED LEVEL` label on core; listening/speaking with 0 shows no fake waveform

## How to add a new state

1. Add to `AiCoreState` + `stateMachine.ts` table
2. Add branch in `coreParamsForState.ts` with distinct ringSpeeds/glow/color/pulse (ensure visually distinct at glance)
3. If new color, add token; if new visual (e.g., double progress), extend `CoreScene.tsx`
4. Add unit test in `coreParams.test.ts` and walk coverage
