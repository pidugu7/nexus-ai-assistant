# NEXUS AI — Events & IPC Channels

> All events and IPC channels are defined in `packages/shared`. No ad-hoc strings.

---

## Event Schemas — `packages/shared/src/events.ts`

Every event has `id`, `timestamp`, `source: "user"|"model"|"system"|"simulated"`, `type`, `payload` (zod-validated). Simulated only via dev panel, dev only, labelled SIMULATED.

| Type | Payload |
|------|---------|
| `voice.listening.started` | `{ reason? }` |
| `voice.listening.stopped` | `{ durationMs? }` |
| `voice.transcript` | `{ text, isFinal }` |
| `llm.thinking` | `{ prompt? }` |
| `llm.token` | `{ token }` |
| `llm.done` | `{ text }` |
| `llm.error` | `{ message }` |
| `tool.started` | `{ tool, input }` |
| `tool.finished` | `{ tool, output }` |
| `tool.failed` | `{ tool, error }` |
| `permission.requested` | `{ tool, permission, input }` |
| `permission.resolved` | `{ tool, granted, actor }` |
| `task.step.started` | `{ step, title? }` |
| `task.step.finished` | `{ step, result? }` |
| `task.step.failed` | `{ step, error }` |
| `system.kill` | `{ reason }` |
| `system.warning` | `{ message, code? }` |
| `error` | `{ message, stack?, code? }` |

Validation: `NexusEventSchema` checks `source` enum, `type` enum, and per-type payload. Bad payloads rejected (`ok:false`).

## IPC Channels — `packages/shared/src/ipc.ts`

| Channel | Direction | Payload |
|---------|-----------|---------|
| `nexus:bus:publish` | renderer → main (invoke) | `NexusEvent → { ok, reason? }` validated, allowlisted only (`RENDERER_PUBLISH_ALLOWLIST`), simulated only in dev |
| `nexus:bus:event` | main → renderer (on) | `NexusEvent` (all bus events) |
| `nexus:state:get` | renderer → main (invoke) | `→ { state }` |
| `nexus:state:changed` | main → renderer (on) | `{ from, to, eventId }` |
| `nexus:log:get` | renderer → main (invoke) | `{ count? } → LogEntry[]` |
| `nexus:log:clear-view` | renderer → main (invoke) | `→ { ok }` (UI clear only, file kept) |
| `nexus:window:*` | renderer ↔ main | (Phase 1, validated `windowActionSchema`) |
| `nexus:log:entry` | main → renderer (on) | `LogEntry` (compat, now via `nexus:bus:event`) |
| `nexus:system:kill` | main → renderer (on) | `{ reason, timestamp }` (compat) |

All `invoke` payloads validated with Zod, exposed only via `preload/contextBridge` (`window.nexus.bus`, `window.nexus.state`, `window.nexus.log`). One bad subscriber never breaks others (try/catch per handler).

## State Machine

States `idle|listening|thinking|executing|speaking|awaiting_approval|warning|error` in `packages/shared/src/stateMachine.ts`. Transition table in `docs/STATE_MACHINE.md`. Illegal `→ reject { ok:false }` + warning log, `system.kill` → `idle` from any.

*Last updated: Phase 2 — 2026-10-23.*
