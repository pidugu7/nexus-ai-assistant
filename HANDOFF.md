# HANDOFF — Phase 3 → Phase 4 (LLM provider layer)

Branch `arena/50354b4e-nexus-ai-assistant` from `main` (aea9ede). Phase 3 done: 3D core.

What was built:
- `coreParamsForState(state,audioLevel)` pure mapping for 8 states, honest: 0 = no fake waveform, tests for all
- R3F core: wireframe sphere, 5 tori, InstancedMesh particles, pulse core, grid+fog, Bloom+Vignette (postprocessing 6.36.3), bright cyan high tier, tokens cyan/amber/red
- Smooth damp + delta cap 0.1, pause when hidden, dispose on unmount
- Quality high(1100)/med(500)/low(120) auto-low on Reduced/battery(dis charging), DPS by tier; FPS overlay real FPS/drawCalls via Ctrl+Alt+Shift+F (main before-input-event KeyF) + Settings toggle
- Fallback 2D SVG on WebGL fail/lost + log warn, error boundary, aria-live State label, Reduced removes flicker
- AudioStore audioLevel 0 default, dev-only slider SIMULATED audio level + SIMULATED LEVEL label, kept Walk all states/DEV/Ctrl+Alt+Shift+D
- Security unchanged (contextIsolation on, sandbox on, prod CSP strict no unsafe-eval), no CDN/procedural only

To run (PowerShell):
```powershell
npm install
npm run lint; npm run typecheck; npm test; npm run build
npm run dev  # walk dev panel, test quality/FPS, reduced
```

Next Phase 4: LLM provider layer (Ollama sidecar, streaming `llm.token`/`done` → state thinking→executing→speaking, no tools).

Warnings: Electron binary needs `ELECTRON_SKIP_BINARY_DOWNLOAD=1`; FPS on RTX 4060 not measured in sandbox (jsdom), report real.

Exact branch: `arena/50354b4e-nexus-ai-assistant`
