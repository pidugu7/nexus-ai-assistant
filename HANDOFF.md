# HANDOFF — Phase 2 → Phase 3

Branch `arena/2ed48b09` from `main` (96cdd2e). Spine done: typed bus, state machine, JSONL log.

What was built:
- Events Zod schemas (`voice.*`, `llm.*`, `tool.*`, `permission.*`, `task.step.*`, `system.*`, `error`) with `id,timestamp,source,payload`; allowlist `RENDERER_PUBLISH_ALLOWLIST`, validated in `TypedEventBus` (unsubscribe, error isolation, bridge `nexus:bus:*`).
- State machine pure TS `idle→listening→thinking→executing→speaking→awaiting_approval→warning→error`, table in `STATE_MACHINE.md`, illegal → `{ok:false}` + warning, `system.kill`→`idle` from any.
- `FileLogStore` JSONL `userData/logs/activity.jsonl`, 5 MB rotate, load last 200, `LogStore` interface (SQLite-ready), Clear view only UI.
- Fixed duplicate `App started` (single `didBootLog` in main, renderer loads from store, `useRef` guard).
- Status bar shows real `IDLE/...` (MODEL NOT CONNECTED kept).
- DevPanel `Ctrl+Alt+Shift+D` dev-only, 16 buttons walk all states + illegal → warning, labels `SIMULATED`, guarded by `app.isPackaged`/`__NEXUS_IS_PACKAGED__`.
- Security: `contextIsolation on`, `sandbox on`, strict prod CSP, dev relaxed via `cspPlugin`, all IPC `packages/shared` Zod + `contextBridge`.

To run (Windows PowerShell):
```powershell
npm install
npm run lint; npm run typecheck; npm test; npm run build
npm run dev  # HUD with IDLE, log SIMULATED dev panel Ctrl+Alt+Shift+D, F11, kill Ctrl+Alt+Shift+K
```

Next Phase 3: Three.js core.
- React Three Fiber in center `AI CORE` frame, driven by `state` (idle pulse, listening ring, thinking spin, etc.), no LLM yet, keep bus/state/log.
- Reuse `stateStore`, `NexusEvent`, glow tokens, reduced-effects.

Warnings: Electron binary needs `ELECTRON_SKIP_BINARY_DOWNLOAD=1` in sandbox; window not verifiable headless (checked build + jsdom).
