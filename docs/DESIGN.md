# NEXUS AI — Design Tokens Reference

> Reusable visual language for the HUD shell. All tokens are CSS variables in `apps/desktop/src/renderer/src/tokens.css`. Phase 1 is static — no 3D yet.

---

## Colors

| Token | Value | Use |
|---|---|---|
| `--bg` | `#04070a` | Near-black page background |
| `--bg-elevated` | `#0b1217` | Titlebar, log header |
| `--bg-panel` | `#0f1b22` | Cards, nav, panels, core |
| `--bg-hover` | `#13202b` | Hover states |
| `--text-primary` | `#e6f0f5` | Headings, body |
| `--text-secondary` | `#8aa0b0` | Labels, secondary |
| `--text-muted` | `#5f7383` | “—”, NOT CONNECTED, disabled mic |
| `--cyan` | `#00e5ff` | Primary, NEXUS AI, active nav, clock |
| `--cyan-border` | `rgba(0,229,255,0.35)` | 1px luminous border |
| `--cyan-glow` | `0 0 10px rgba(0,229,255,0.45)` | Glow utility (disabled when reduced) |
| `--amber` | `#ffb02e` | OFFLINE pill |
| `--red` | `#ff3b4a` | Close hover, error logs |

## Typography

| Token | Value |
|---|---|
| `--font-display` | `Inter` (via `@fontsource/inter`, bundled locally — CSP `self`) |
| `--font-mono` | `JetBrains Mono` (via `@fontsource/jetbrains-mono`, data/mono) |

Use `font-mono` for clocks, nav, SYSTEM STATUS rows, logs; `font-display` for headings. No CDN fonts.

## Borders

```
--border: 1px solid var(--cyan-border)   // luminous
--border-muted: 1px solid rgba(255,255,255,0.08)
--border-amber / --border-red
```
Apply `border-luminous` + `glow-cyan` for active nav; muted elsewhere.

## Spacing & Radius

```
--space-1:4px  --space-2:8px  --space-3:12px  --space-4:16px  --space-6:24px  --space-8:32px
--radius-sm:4px  --radius-md:8px  --radius-lg:12px  --radius-xl:16px
```

## Motion

* Framer Motion `duration ≤0.30s`, `easeInOut`. Panels/log use `AnimatePresence`.
* `[data-reduced="true"]` disables `transition`/`animation` and glow. Toggle in Settings (`useSettingsStore`, `localStorage` try/catch, key `nexus:reduced-effects`).

## Utilities

`.glow-cyan`, `.border-luminous`, `.text-cyan`, `.text-muted`, `.font-mono`

## Responsive

Min window `1100×680`. Grid `200px 1fr 280px` → `180/240` → `160/220` at breakpoints, tested at 1366×768 & 1920×1080 (no overflow, see `HANDOFF`).

## Core Visuals (Phase 3)

3D core `apps/desktop/src/renderer/src/core/CoreScene.tsx` — procedural only (no CDN textures/models): translucent wireframe sphere, 5 rotating tori, instanced orbital particles, pulsing icosahedron inner core, grid floor + fog, Bloom+Vignette via `@react-three/postprocessing`. Colors from tokens (cyan primary, amber warning, red error). Driven by `coreParamsForState(state, audioLevel)` (pure, tested for 8 states); honest: audioLevel 0 = no fake waveform; dev slider sets it with `SIMULATED LEVEL` label. Quality tiers high(1100)/medium(500)/low(120) + bloom levels; Reduced forces low; battery discharging forces low (try/catch). Pause when hidden/minimized; dispose on unmount.

## Honest UI Rule

No fake numbers. Right panel shows `—` (muted mono) and `ACTIVE TASK: None`. Only live value is clock (`lib/formatClock.ts`). Core animations are driven only by real state + audioLevel (0 until Phase 7); dev simulated level is labelled.
