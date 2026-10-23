# NEXUS AI — Roadmap

> No AI/voice/3D/system data beyond what is checked. This tracks phased delivery.

---

## Phase 0 — Foundation (done)

- [x] Monorepo scaffold (`apps/desktop`, `packages/shared`, `services/sidecar`)
- [x] Electron + React + Vite + TypeScript strict
- [x] Secure window (contextIsolation on, nodeIntegration off, sandbox on, CSP strict prod / dev-relaxed)
- [x] ESLint + Prettier + Vitest + sample + CSP tests
- [x] CI on `windows-latest` (install → lint → typecheck → test → build)
- [x] Docs: `AGENTS.md`, `ARCHITECTURE.md`, `PERMISSIONS.md`, `EVENTS.md`, `ROADMAP.md`
- [x] `.env.example`, `.gitignore`

---

## Phase 1 — Application Shell & Static HUD (this phase, done)

- [x] Frameless window + custom titlebar (app name, minimize/maximize-restore/close, draggable bar, non-draggable buttons, F11 fullscreen via validated IPC `nexus:window:*`)
- [x] Kill-switch globalShortcut `Ctrl+Alt+Shift+K` (warn & continue if registration fails, emits `system.kill`)
- [x] Five regions + log: Top status bar (`NEXUS AI` / `OFFLINE (UI ONLY)` / `NOT CONNECTED` / live clock), Left nav (8 items, keyboard + active highlight), Center `AI CORE (Phase 3)` placeholder, Right `SYSTEM STATUS` honest `—`/`None`, Bottom command bar stub + disabled mic `Voice arrives in Phase 7`, collapsible activity log (real entries: app started, hotkey, window events)
- [x] Design tokens as CSS variables (`tokens.css`: near-black, cyan/amber/red, luminous 1px borders, glow, spacing/radius, `@fontsource/inter` + `@fontsource/jetbrains-mono` bundled — CSP `self`, no CDN) + `docs/DESIGN.md`
- [x] Motion: Framer Motion ≤300 ms for panels/log; `Reduced effects` toggle (Settings, `localStorage` try/catch, `data-reduced` disables glow/transitions)
- [x] Responsive: grid `200/1fr/280` → 180/240 → 160/220, min window `1100×680`, no overflow at 1366×768 & 1920×1080
- [x] Tests: clock formatter, nav state, command submit, reduced-effects persistence, shell component test (`@testing-library/react`)
- [x] New IPC typed in `packages/shared/src/ipc.ts` + events in `events.ts`, validated + `contextBridge` only; prod CSP stays strict (test passes); docs updated

---

## Phase 2 — Engine & Tool Framework (next)

- Typed IPC registry + Zod-validated `nexus:tool:call` + permission gate (tiers 0–3)
- Tool contract `{ name, input, permission, execute, verify }` with allowlisted folders
- SQLite (`better-sqlite3`) for event log + tool history
- Event bus impl (main ↔ renderer + sidecar) + `window.nexus` full API
- Tests: validation, permission flows, `verify()` checks

---

## Phase 3 — HUD / 3D Core

- React Three Fiber placeholder wiring into Center `AI CORE` frame
- Ambient visuals driven by real `engine:status` events
- Performance target 60 fps idle on RTX 4060

---

## Phase 4 — Local AI & Sidecar

- Python sidecar (FastAPI + stdio) + Ollama (`llama3.1`) tool proposals
- Prompt-injection defenses; streaming tool calls

---

## Phase 5 — Voice I/O

- STT/TTS, waveform HUD, push-to-talk, mic consent (mic button currently disabled)

---

## Phase 6 — Workspace & Automation

- Scoped file tools, desktop automation, system monitoring (replaces `—` with real data), installer

---

## Out of Scope (never)

- Marvel/Disney branding, copyrighted HUD replicas.
- Arbitrary code exec — all via registered tools.
- Cloud-only LLM without consent — local-first.

---

*Last updated: Phase 1 — 2026-10-22.*
