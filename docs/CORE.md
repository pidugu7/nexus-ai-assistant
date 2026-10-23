# NEXUS AI — 3D Core (Phase 3)

Procedural cinematic core driven ONLY by real `state` + `audioLevel` (0 until Phase 7). No LLM/voice/tools.

## State → Visual mapping — `coreParamsForState(state, audioLevel)` (pure, no Three)

| State | Rings | Particles | Glow | Color | Pulse | Spread | Progress | Waveform | Notes |
|---|---|---|---|---|---|---|---:|---|---|
| `idle` | slow 0.15/-0.12 | 0.2 | 0.55 | cyan | 0.08 | 1.0 | hidden | hidden | dim, slow |
| `listening` | 0.22+ lvl, expanding | 0.25 | 0.7+0.3·lvl | cyan | 0.05+0.07·lvl | 1+0.28·lvl | hidden | **visible** (driven by lvl; with 0 stays minimal) | heartbeat from audio |
| `thinking` | fast 0.45/-0.38 | 1.4 | 0.85 | cyan | 0.06 | 1.08 | hidden | hidden | orbital frenzy |
| `executing` | 0.6/-0.45 | 0.9 | 0.9 | cyan | 0.04 | 1.06 | **visible** segmented ring | hidden | progress arc rotates |
| `speaking` | 0.18+0.25·lvl | 0.35+0.4·lvl | 0.75+0.35·lvl | cyan | 0.07+0.18·lvl | 1+0.22·lvl | hidden | visible only if lvl>0.02 | pulse from audio, 0 = no fake |
| `awaiting_approval` | slow 0.12 | 0.15 | 0.95 | **amber** | 0.22 | 1.04 | hidden | hidden | amber pulse |
| `warning` | 0.35/-0.3 | 0.5 | 0.9 | cyan→amber 0.55 | 0.12 | 1.07 | hidden | hidden | amber highlights |
| `error` | 0.3/-0.25 | 0.6 | 1.0 | **red** | 0.1 | 1.0 | hidden | hidden | red flicker (random) |

All params `THREE.MathUtils.damp(target, 3-6, dt)` with `dt = min(delta,0.1)` so hidden→visible never jumps.

## Scene graph — `apps/desktop/src/renderer/src/core/CoreScene.tsx`

- `<Canvas frameloop={paused?"never":"always"} dpr={tier.dpr}>` + `fog(#04070a,6,12)`
- Wireframe `SphereGeometry(0.82,32)` + inner `Icosahedron(0.38,2)` pulsing
- 5 `TorusGeometry` rings at tilts `[0.35,0], [0.9,0.6] …` radii 1.02–1.58
- `InstancedMesh` particles (`SphereGeometry 0.06`) count by tier; `setMatrixAt` each frame
- `RingGeometry` waveform (listening/speaking) scaled by audioLevel, `RingGeometry` progress (executing)
- `gridHelper(10,20)` floor, `ambientLight`, 2 `pointLight` tinted by state color
- Post: `EffectComposer > Bloom(intensity tier, radius, threshold 0.7) + Vignette(offset0.25,darkness0.55)` – `low` disables bloom
- Colors from tokens `--cyan #00e5ff`, `--amber #ffb02e`, `--red #ff3b4a`

## Quality tiers — `useQuality.ts`

| Tier | Particles | Bloom | DPR | When |
|---|---|---|---|---|
| high | 1100 | 1.3/0.75 enabled | 1.5 | default (high tier bright, verified 60 fps target RTX 4060) |
| medium | 500 | 0.9/0.6 enabled | 1.1 | manual |
| low | 120 | 0.6/0.4 disabled | 1 | Reduced ON or `navigator.getBattery()` reports `!charging` (try/catch; unavailable → medium) |

Settings `select` persists `nexus:quality`; Reduced forces low via `resolveQualityTier({manual,reduced,batteryDischarging})`.

## Performance & lifecycle

- Pause: `document.hidden`, `window blur/focus`, `frameloop="never"`; cap delta 0.1 after hidden
- Dispose: `gl.dispose()`, `geometry.dispose()`, `material.dispose()` on `onCreated` cleanup and `useEffect` unmount; remove `webglcontextlost`, `visibilitychange`, `battery chargingchange` listeners; no growth on 10 min walk
- Reduced: `data-reduced="true"` disables bloom/flicker, `duration 0` transitions (already in store)

## Fallbacks

- `Canvas onError` or `canvas.addEventListener("webglcontextlost",…)` → `setWebglFailed/contextLost` → `<FallbackCore state reason>` (SVG 3 circles + state label), `logStore.addEntry` warn `core.fallback`, keep app usable
- `CoreErrorBoundary` catches render errors → fallback + log

## FPS & debug overlay

- Toggle: `Ctrl+Alt+Shift+F` via main `before-input-event input.code==="KeyF"` → `NEXUS_IPC.FPS_TOGGLE` → `window.nexus.fps.onToggle` → `settingsStore.toggleFpsOverlay()` + Settings switch `data-testid="fps-toggle"` (default off)
- Measures real: `requestAnimationFrame` 500 ms window → FPS, `gl.info.render.calls` → draw calls, `settings.particleCount`, tier, state; `FpsOverlay` shown only when enabled (and not when Reduced)

## Accessibility & honesty

- `aria-live="polite"` label `State: THINKING` (`data-testid="core-state-label"`) near canvas
- Reduced removes flicker/strong pulsing
- Honest: `audioLevel` from `audioStore` default 0; dev-only slider `SIMULATED audio level` sets it and shows `SIMULATED LEVEL` label on core; listening/speaking with 0 shows no fake waveform

## How to add a new state

1. Add to `AiCoreState` + `stateMachine.ts` table
2. Add branch in `coreParamsForState.ts` with distinct ringSpeeds/glow/color/pulse
3. If new color, add token; if new visual (e.g., double progress), extend `CoreScene.tsx`
4. Add unit test in `coreParams.test.ts` and walk coverage
