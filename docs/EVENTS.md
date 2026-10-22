# NEXUS AI — Events & IPC Channels

> All events and IPC channels are defined in `packages/shared`. No ad-hoc strings.

---

## IPC Channels (main ↔ renderer)

| Channel | Direction | Payload | Tier | Description |
|---------|-----------|---------|------|-------------|
| `nexus:ping` | renderer → main (invoke) | `{} → { ok: boolean, message: string }` | 0 | Smoke-test handler, verifies IPC plumbing. Foundation only. |
| `nexus:tool:call` | renderer → main (invoke, future) | `{ tool: string, input: unknown } → { ok: boolean, output?: unknown, error?: string }` | varies | LLM proposes tool, engine validates + permission-gates + executes + verifies. |
| `nexus:tool:consent` | renderer → main (invoke, future) | `{ tool: string, approved: boolean, remember?: boolean }` | — | Renderer responds to permission dialog for tiers 2/3. |

- All `invoke` payloads validated with Zod in `apps/desktop/src/main`.
- Preload exposes only `window.nexus.ping()` (and future typed wrappers) via `contextBridge`.

---

## Event Bus (typed)

Defined in `packages/shared/src/events.ts` as `NexusEventMap`:

```ts
export type NexusEventMap = {
  "engine:status": { state: "idle" | "ready" | "busy" | "error"; message?: string };
  "engine:tool-call": { tool: string; input: unknown; permission: number };
  "engine:tool-result": { tool: string; ok: boolean; output?: unknown; error?: string };
  "ui:theme-changed": { theme: "light" | "dark" };
};
```

- UI visuals driven only by real events, never fake data (see `AGENTS.md` §2).
- Implementation: main-process `EventEmitter` + IPC broadcasts; renderer subscribes via `ipcRenderer.on` wrapped in preload.

---

## Adding a New Event

1. Add entry to `NexusEventMap` in `packages/shared/src/events.ts`.
2. Document it here (name, payload, producer, consumer).
3. Emit only via typed bus (`bus.emit("engine:status", …)`).
4. Update renderer to handle it — never use inline string names.

---

*Last updated: 2026-10-22 — Foundation phase.*
