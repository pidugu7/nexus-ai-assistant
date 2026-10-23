# NEXUS AI — State Machine

Source: `packages/shared/src/stateMachine.ts` — pure TypeScript, no Electron imports.

## States

`idle` · `listening` · `thinking` · `executing` · `speaking` · `awaiting_approval` · `warning` · `error`

Initial: `idle`. `system.kill` returns to `idle` from **any** state and cancels everything.

## Transition Table

| From | Event | To |
|------|-------|----|
| idle | `voice.listening.started` | listening |
| listening | `voice.listening.stopped` | idle |
| listening | `voice.transcript` | thinking |
| thinking | `llm.token` | thinking |
| thinking | `llm.done` | executing |
| thinking | `llm.error` | error |
| thinking | `tool.started` | executing |
| executing | `tool.finished` | thinking |
| executing | `tool.failed` | error |
| executing | `permission.requested` | awaiting_approval |
| awaiting_approval | `permission.resolved:granted` | executing |
| awaiting_approval | `permission.resolved:denied` | thinking |
| executing | `task.step.started` | executing |
| executing | `task.step.finished` | executing |
| executing | `task.step.failed` | error |
| executing | `llm.done` | speaking |
| speaking | `voice.listening.stopped` | idle |
| thinking/executing/speaking | `system.warning` | warning |
| warning | `system.kill` | idle |
| warning | `voice.listening.started` | listening |
| * | `system.kill` | idle |
| * | `error` | error |
| error | `system.kill` | idle |
| error | `voice.listening.started` | listening |

Illegal transitions: `transition()` returns `{ ok:false, reason }` and logs warning — never throws. Renderer receives `state:changed` only on success; illegal attempts emit `log:warning` with reason.

## Dev Simulated Flow

Dev panel (Ctrl+Alt+Shift+D, dev only) publishes `source: simulated` events to walk: listening → thinking → executing → speaking → idle, plus `awaiting_approval`, `warning`, `error`, `kill`, and one illegal (e.g., `llm.token` from `idle`).

## Persistence

State not persisted; log (which includes transitions) is persisted via JSONL (5 MB rotate, last 200 on boot).
