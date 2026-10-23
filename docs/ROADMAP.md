# NEXUS AI — Roadmap

> Roadmap order per Phase 2 prompt: Phase 2 = bus+state+log, Phase 3 = 3D core, Phase 4 = LLM, Phase 5 = tool registry, Phase 6 = core tools, Phase 7 = voice.

## Phase 0 — Foundation (done)
- [x] Scaffold, secure window (contextIsolation on, nodeIntegration off, sandbox on, CSP strict/ dev-relaxed), CI, CSP tests

## Phase 1 — Application Shell & Static HUD (done)
- [x] Frameless window + custom titlebar + F11, kill-switch Ctrl+Alt+Shift+K, five regions + log (honest —), tokens (Inter/JetBrains Mono local, no CDN), motion ≤300ms + Reduced effects, responsive 1100×680, tests

## Phase 2 — Event bus + state machine + activity log (this phase, done)
- [x] Zod-validated typed events `voice.*`/`llm.*`/`tool.*`/`permission.*`/`task.step.*`/`system.*`/`error` with `id,timestamp,source,payload` + allowlist
- [x] Main `TypedEventBus` validated, unsubscribe, error isolation, bridge `nexus:bus:*`
- [x] Pure TS state machine `idle|listening|thinking|executing|speaking|awaiting_approval|warning|error` + table, illegal→reject + warning, `system.kill`→`idle`
- [x] JSONL `LogStore` (userData/logs/activity.jsonl, 5 MB rotate, load last 200, Clear view only UI) + never log secrets
- [x] Fix duplicate App started (single `didBootLog` in main, renderer loads from store)
- [x] Status bar shows real `IDLE/LISTENING/...` (MODEL: NOT CONNECTED)
- [x] Dev panel `Ctrl+Alt+Shift+D` (dev only) walks all states + illegal → warning, labels SIMULATED
- [x] Tests: all valid/illegal transitions, kill, validation, isolation, JSONL rotation, duplicate regression, component status/log
- [x] Docs `EVENTS.md`, `STATE_MACHINE.md`, `ROADMAP.md`; CSP still strict (test passes), dev panel absent in prod (verified via `__NEXUS_IS_PACKAGED__`)

## Phase 3 — 3D AI core (done)
- [x] `coreParamsForState(state,audioLevel)` pure mapping for 8 states, tests for all states + honest 0-level
- [x] R3F scene: wireframe sphere, 5 tori, instanced particles, pulsing core, grid+fog, Bloom/Vignette, tokens cyan/amber/red, bright high tier
- [x] Smooth damp transitions, delta cap 0.1, pause when hidden, dispose on unmount (no leak 10 min)
- [x] Quality low/medium/high (120/500/1100 particles) auto-low on Reduced/battery, FPS overlay (Ctrl+Alt+Shift+F + Settings) with real FPS/drawCalls
- [x] Fallback 2D SVG on WebGL fail/lost + log warn, error boundary, aria-live state label, Reduced respects
- [x] Dev slider SIMULATED audio level, existing buttons kept
- [x] Tests: coreParams, quality tiers (battery, reduced), fallback + state label, CSP still strict

## Phase 4 — LLM
- Local Ollama sidecar, streaming tokens via `llm.token`/`done`

## Phase 5 — Tool registry + permissions
- Tool contracts, allow-listed `nexus:tool:call`, gated by permission tiers

## Phase 6 — Core tools
- File tools (allowed-folders), scoped FS, verified

## Phase 7 — Voice
- STT/TTS, mic button enabled, `voice.listening.*`

*Out of scope: Marvel/Disney, arbitrary exec, cloud-only LLM.*

*Last updated: Phase 2 — 2026-10-23.*
