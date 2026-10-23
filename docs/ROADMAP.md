# NEXUS AI — Roadmap

> No features beyond the blank secure window in foundation. This roadmap tracks phased delivery.

---

## Phase 0 — Foundation (current)

- [x] Monorepo scaffold (`apps/desktop`, `packages/shared`, `services/sidecar`)
- [x] Electron + React + Vite + TypeScript strict
- [x] Secure window (contextIsolation on, nodeIntegration off, CSP)
- [x] ESLint + Prettier + Vitest + sample test
- [x] CI on `windows-latest` (install → lint → typecheck → test → build)
- [x] Docs: `AGENTS.md`, `ARCHITECTURE.md`, `PERMISSIONS.md`, `EVENTS.md`, `ROADMAP.md`
- [x] `.env.example`, `.gitignore`

---

## Phase 1 — Engine & Tool Framework

- Typed IPC registry + Zod-validated `nexus:tool:call` + permission gate (tiers 0–3)
- Tool contract: `{ name, input, permission, execute, verify }` with allowlisted folders
- SQLite integration (better-sqlite3) for event log + tool history
- Event bus implementation (main ↔ renderer + sidecar)
- Preload exposes full `window.nexus` typed API
- Tests: tool validation, permission flows, verify() checks

---

## Phase 2 — HUD / 3D Foundation

- React Three Fiber scene, original NEXUS visuals (no Marvel/Disney assets)
- Ambient orb / status ring driven by real `engine:status` events
- Theme + layout polish, window controls, tray integration
- Performance profiling on RTX 4060 (target 60 fps idle)

---

## Phase 3 — Voice I/O

- STT (Whisper via sidecar or native) → text → engine
- TTS + lip-sync / waveform in HUD
- Push-to-talk + wake-word (optional)
- Voice permission UX (mic consent)

---

## Phase 4 — Local AI & Sidecar

- Python sidecar (FastAPI + stdio) for LLMs (Ollama), tools, CV
- Ollama integration: `llama3.1`, `phi3`, etc. — prompt → tool proposals
- Prompt-injection defenses: web/file text treated as data
- Streaming tool calls + partial rendering

---

## Phase 5 — Workspace & Automation

- File/workspace tooling (scoped to allowed folders)
- Desktop automation tools (open app, clipboard, screenshots)
- System monitoring (CPU/GPU/RAM overlays)
- Auto-update, installer (Electron Builder for Windows)

---

## Out of Scope (never)

- Marvel/Disney branding, copyrighted HUD replicas.
- Arbitrary code execution by LLM — all actions go through registered tools.
- Cloud-only LLM without user consent — local-first.

---

*Last updated: 2026-10-22.*
