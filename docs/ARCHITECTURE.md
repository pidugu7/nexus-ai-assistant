# NEXUS AI — Architecture

> This document is the single source of truth for the system architecture, module boundaries, and assumptions made during the foundation phase.

---

## 1. Overview

NEXUS AI is a voice-driven cinematic desktop assistant (original, not branded after Marvel/Disney). It runs on **Windows 11** with **Ryzen 7 + RTX 4060 (8 GB VRAM) + 24 GB RAM** and is built with:

- **Electron (electron-vite)** + **React** + **TypeScript strict** + **React Three Fiber** (future HUD/3D)
- **Node main-process engine** — orchestration, tooling, permissions
- **Optional Python sidecar** — local AI/Vision workloads (future)
- **SQLite** — local persistence (future)

The system is designed to keep the LLM as a **planner only**: it proposes tool calls, never executes code or touches the OS directly.

---

## 2. Text Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         RENDERER (UI)                           │
│  React + R3F HUD • Voice waveform • Tool consent dialogs        │
│  - Displays only real events from the event bus                │
│  - Never mutates engine state directly                          │
│  - No Node/Electron APIs (contextIsolation on)                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ typed IPC (ipcRenderer.invoke/handle)
                                │ preload: window.nexus (contextBridge)
┌───────────────────────────────▼─────────────────────────────────┐
│                      MAIN PROCESS ENGINE                        │
│  - IPC router (validated with Zod)                              │
│  - Permission gate (tiers 0–3)                                  │
│  - Tool registry + execute() + verify()                          │
│  - Event bus publisher (SQLite log)                             │
│  - Sidecar coordinator (child_process)                          │
└───────────────┬───────────────────────────────┬─────────────────┘
                │ tool layer                    │ sidecar RPC
┌───────────────▼───────────────┐   ┌───────────▼───────────────┐
│          TOOL LAYER           │   │    PYTHON SIDECAR         │
│  - fs.read/list/write (scoped)│   │  (placeholder for now)    │
│  - system.* (scoped)          │   │  - Local LLM via Ollama   │
│  - web.search/fetch           │   │  - STT/TTS pipelines      │
│  - Each tool: name, zod,      │   │  - Vision / CV (future)   │
│    permission, execute, verify│   │  Communicates only via    │
│  - Allowed folders only       │   │  engine over stdio/HTTP   │
└───────────────────────────────┘   └───────────────────────────┘
                                │
                ┌───────────────▼───────────────┐
                │      SQLite (better-sqlite3)  │
                │  - Event log                  │
                │  - Tool call history          │
                │  - User preferences           │
                └───────────────────────────────┘

Event flow (example):
  User says "open file" → STT → LLM proposes tool `fs.readFile` → engine validates input → checks permission (tier 1: notify) → execute() → verify() → emit `engine:tool-result` → renderer updates UI.
```

---

## 3. Module Boundaries

| Module | Location | Responsibility |
|--------|----------|----------------|
| `apps/desktop/src/renderer` | React UI | Render state, request tool calls via IPC, show permission dialogs. No direct FS/OS. |
| `apps/desktop/src/preload` | Preload script | `contextBridge.exposeInMainWorld("nexus", …)` — only typed `invoke` wrappers. |
| `apps/desktop/src/main` | Electron main | Window creation (secure), IPC handlers, permission checks, event bus, sidecar lifecycle. |
| `packages/shared` | Shared package | IPC channel constants, Zod schemas, `NexusEventMap`, `ToolDefinition`, permission tier enum. Single source of truth. |
| `services/sidecar` | Python placeholder | Future: FastAPI/stdio bridge for local models (Ollama, Whisper, etc.). Only reachable via engine. |
| `tests` | Root tests | Cross-package integration tests. |
| `docs` | Docs | Architecture, events, permissions, roadmap. |

---

## 4. IPC Contract

- Defined in `packages/shared/src/index.ts` and `packages/shared/src/events.ts`.
- **Channels**: prefixed `nexus:*` (e.g., `nexus:ping`, `nexus:tool:call`). No ad-hoc strings.
- **Payloads**: validated with Zod in main process before any use.
- **Preload**: exposes `window.nexus.ping()` etc., never raw `ipcRenderer`.
- **CSP**: enforced both in `index.html` `<meta>` and via `session.webRequest.onHeadersReceived` in main.

### CSP Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self';
```

Rationale: allow Vite HMR (`connect-src` widened only in dev) and inline styles for React, but no remote scripts, no `unsafe-eval`.

---

## 5. Tool Layer (Future)

- See `docs/PERMISSIONS.md` for tier definitions.
- Every tool: `{ name, description, input: zodSchema, permission, execute, verify }`.
- Engine validates `input` first, then checks permission, then calls `execute()`, then `verify()`.
- Only allowed folders (configured by user) are accessible — default deny.
- Text from web/files is data, never instructions (prompt-injection defense).

---

## 6. Security Model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` — see `AGENTS.md` §5.
- All IPC inputs validated.
- Strict CSP.
- No secrets in code (`.env.example` only).
- Allowed-folders allowlist.
- Tool permission tiers 0–3.

---

## 7. Build & Tooling

- **Monorepo**: `npm workspaces` (`apps/*`, `packages/*`).
- **Bundler**: `electron-vite` with separate `main`, `preload`, `renderer` configs.
- **TypeScript**: `strict: true` everywhere, project references (`tsconfig.json` → `apps/desktop`, `packages/shared`).
- **Lint**: ESLint 8 with `typescript-eslint`, `react`, `react-hooks`, `prettier` (no conflicts).
- **Format**: Prettier 3.
- **Tests**: Vitest 1.x, one sample passing test in `packages/shared`.
- **CI**: GitHub Actions on `windows-latest`: install → lint → typecheck → test → build.

---

## 8. Assumptions

> Recorded here per `AGENTS.md` §9. Chose simplest option where spec was ambiguous.

| # | Topic | Assumption |
|---|-------|-----------|
| 1 | **electron-vite version** | Used `electron-vite@2.3` + `electron@30` + `vite@5` — stable, Windows-friendly, supports `externalizeDepsPlugin`. |
| 2 | **Renderer bundler** | Kept `electron-vite` defaults for `main`/`preload`/`renderer` outDirs (`out/main`, `out/preload`, `out/renderer`). No custom output paths. |
| 3 | **Workspaces** | `npm workspaces` (not pnpm/yarn) — simplest on Windows, no extra tooling. Root scripts delegate via `npm run --workspace=@nexus/desktop`. |
| 4 | **ESLint** | ESLint 8 (not 9) — broader plugin support (eslint-config-prettier, react plugins) without migration overhead. Flat config postponed. |
| 5 | **Prettier** | Default Prettier 3 with `lf` line endings even on Windows (Git `core.autocrlf` handles conversion). Keeps CI deterministic. |
| 6 | **TypeScript** | `moduleResolution: bundler` for Vite compatibility; `composite: true` for project references. |
| 7 | **Python sidecar** | Placeholder README only — no venv/requirements yet. Future phases will add FastAPI + Ollama integration. |
| 8 | **SQLite** | Not installed yet — noted as future dep (`better-sqlite3`). Avoided native module in foundation to keep `npm install` fast on Windows. |
| 9 | **No HUD/3D** | `react-three-fiber` not installed yet — adding it would bloat foundation without usage. Will add in Phase 2 with `three` + `@react-three/fiber`. |
| 10 | **Security** | `sandbox: true` in addition to `contextIsolation:true` / `nodeIntegration:false` — slightly stricter than minimum, still compatible with `preload`. |
| 11 | **IPC** | Single `nexus:ping` handler for foundation smoke-test; full `nexus:tool:call` registry deferred to next phase. |
| 12 | **CI** | `windows-latest` runner, `actions/setup-node@v4` with Node 20 LTS, `npm ci` (fallback `npm install` if no lockfile yet), lint/typecheck/test/build in sequence. |
| 13 | **Paths** | Forward slashes in code/config (Node resolves on Windows). PowerShell examples use `\\` in docs for user copy-paste, but npm scripts stay `/` for cross-platform. |
| 14 | **No secrets** | `.env.example` only; `.env` remains gitignored via existing `.gitignore`. |

---

## 9. Future Work

See `docs/ROADMAP.md`. No TODOs in code.

---

*Foundation phase — 2026-10-22*
