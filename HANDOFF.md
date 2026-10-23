# HANDOFF — Phase 2 CLEANUP → Phase 3

Branch `arena/2ed48b09-nexus-ai-assistant` from `main` (96cdd2e). Spine + live push + cleanup done.

What was built:
- Events Zod schemas (`voice.*`, `llm.*`, `tool.*`, `permission.*`, `task.step.*`, `system.*`, `error`) with `id,timestamp,source,payload`; allowlist `RENDERER_PUBLISH_ALLOWLIST`, validated in `TypedEventBus` (unsubscribe, error isolation, bridge `nexus:bus:*`).
- State machine pure TS `idle→listening→thinking→executing→speaking→awaiting_approval→warning→error`, table in `STATE_MACHINE.md`, illegal → `{ok:false}` + warning, `system.kill`→`idle` from any.
- `FileLogStore` JSONL `userData/logs/activity.jsonl`, 5 MB rotate, load last 200 (`slice(-200)` keeps newest), `LogStore` interface (SQLite-ready), Clear view only UI, auto-scroll to bottom.
- Fixed duplicate `App started` (single `didBootLog` in main, renderer loads from store, `useRef` guard).
- **Fixed duplicate state log**: main `persistAndBroadcast` for `state idle → listening` + renderer `state.onChanged` both emitted. Now renderer only `setState`, main is single source via `LOG_ENTRY`. Regression test: one valid event → exactly one `state idle → listening` entry.
- **Fixed DevPanel counter**: `Events received this session` now counts live `bus.onEvent` since launch (sessionCount), not `entries.length` (history 200). Regression test proves history 200 → count 0, live 2 → count 2. Diagnostics box kept dev-only (`data-testid="diagnostics"` with clicks/state/log/lastError).
- **Reduced effects**: default OFF. Store now tracks `storedValue` (`boolean | null` where `null` = follow system), `effectiveReduced`, `reducedSource` (`default`/`stored`/`system`), `systemPrefersReduced` via `matchMedia('(prefers-reduced-motion: reduce)')`. `data-reduced` set from `effectiveReduced`. Settings shows source + OS preference + “Following system setting” label and “Follow system setting” toggle to override. Why `data-reduced="true"` is on is visible in Settings (source + system value).
- Status bar shows real `IDLE/...` (MODEL NOT CONNECTED kept).
- DevPanel `Ctrl+Alt+Shift+D` dev-only, 16 buttons + “Walk all states” (1.2s interval), labels `SIMULATED`, guarded by `app.isPackaged`/`__NEXUS_IS_PACKAGED__`. Kept DEV button and shortcut. Temporary `[HOP n]` tracing removed from renderer/preload/main; diagnostics kept dev-only, round-trip test kept.
- Security: `contextIsolation on`, `sandbox on`, strict prod CSP, dev relaxed via `cspPlugin`, all IPC `packages/shared` Zod + `contextBridge`.

To run (Windows PowerShell):
```powershell
npm install
npm run lint; npm run typecheck; npm test; npm run build
npm run dev  # HUD with IDLE, log SIMULATED, dev panel Ctrl+Alt+Shift+D, F11, kill Ctrl+Alt+Shift+K
```

Next Phase 3: Three.js core.
- React Three Fiber in center `AI CORE` frame, driven by `state` (idle pulse, listening ring, thinking spin, etc.), no LLM yet, keep bus/state/log.
- Reuse `stateStore`, `NexusEvent`, glow tokens, reduced-effects (`data-reduced`).

Warnings: Electron binary needs `ELECTRON_SKIP_BINARY_DOWNLOAD=1` in sandbox; window not verifiable headless (checked build + jsdom + `data-reduced` attribute).

Could not verify: real Electron window rendering and OS `prefers-reduced-motion` live toggle (requires manual Settings check: open Settings → see Source line and “Following system setting” label, toggle “Follow system setting”).

Exact branch to pull: `arena/2ed48b09-nexus-ai-assistant` (tip 937b4ab → new).
