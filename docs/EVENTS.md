# NEXUS AI — Events & IPC Channels

> All events and IPC channels are defined in `packages/shared`. No ad-hoc strings.

---

## IPC Channels (main ↔ renderer) — typed in `packages/shared/src/ipc.ts`

| Channel | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `nexus:ping` | renderer → main (invoke) | `{} → { ok: boolean, message: string }` | Smoke-test (Phase 0). |
| `nexus:window:minimize` | renderer → main (invoke) | `void → { ok: boolean }` | Custom titlebar minimize. Validated with `windowActionSchema`. |
| `nexus:window:maximize` | renderer → main (invoke) | `void → { ok: boolean }` | Maximize/restore toggle. |
| `nexus:window:close` | renderer → main (invoke) | `void → { ok: boolean }` | Close window. |
| `nexus:window:toggle-fullscreen` | renderer → main (invoke) | `void → { ok: boolean, isFullscreen?: boolean }` | F11 + IPC toggle. |
| `nexus:window:is-maximized` | renderer → main (invoke) | `void → { isMaximized: boolean }` | Query maximized state for titlebar icon. |
| `nexus:window:is-fullscreen` | renderer → main (invoke) | `void → { isFullscreen: boolean }` | Query fullscreen. |
| `nexus:window:maximized-changed` | main → renderer (on) | `{ isMaximized: boolean }` | Broadcast maximize/unmaximize. |
| `nexus:window:fullscreen-changed` | main → renderer (on) | `{ isFullscreen: boolean }` | Broadcast fullscreen. |
| `nexus:system:kill` | main → renderer (on) | `{ reason: string, timestamp: string }` | Kill-switch Ctrl+Alt+Shift+K. |
| `nexus:log:entry` | main → renderer (on) | `LogEntry { id, timestamp, level, message }` | Real app logs. |
| `nexus:tool:call` | renderer → main (invoke, future) | `{ tool: string, input: unknown } → { ok, output? }` | LLM tool proposals (Phase 2+). |

All `invoke` payloads validated with Zod in `apps/desktop/src/main` (`windowActionSchema`). Only exposed via `preload/contextBridge` (`window.nexus.window.*`, `window.nexus.system.*`, `window.nexus.log.*`).

---

## Event Bus (typed) — `packages/shared/src/events.ts` (`NexusEventMap`)

```ts
export type NexusEventMap = {
  "engine:status": { state: "idle" | "ready" | "busy" | "error"; message?: string };
  "engine:tool-call": { tool: string; input: unknown; permission: number };
  "engine:tool-result": { tool: string; ok: boolean; output?: unknown; error?: string };
  "ui:theme-changed": { theme: "light" | "dark" };
  "system.kill": { reason: string; timestamp: string };           // Phase 1: kill-switch
  "window:maximized-changed": { isMaximized: boolean };          // Phase 1: titlebar sync
  "window:fullscreen-changed": { isFullscreen: boolean };         // Phase 1: F11 sync
  "log:entry": { id: string; timestamp: string; level: "info"|"warn"|"error"; message: string }; // Phase 1: activity log
};
```

- UI visuals driven only by real events, never fake data (see `AGENTS.md` §2). Right panel is honest: CPU/GPU/RAM/NETWORK show `—` until Phase 4 telemetry.
- Preload re-emits main IPC as typed bus events; renderer subscribes via `window.nexus`.

---

## Adding a New Event

1. Add entry to `NexusEventMap` in `packages/shared/src/events.ts` and/or `NEXUS_IPC` in `packages/shared/src/ipc.ts`.
2. Document it here.
3. Validate with Zod in main, expose only via `contextBridge`.
4. Renderer subscribes with typed handler — never inline string names.

---

*Last updated: Phase 1 — 2026-10-22.*
