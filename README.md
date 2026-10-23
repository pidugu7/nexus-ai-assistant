# NEXUS AI — Foundation

> An original, voice-driven cinematic AI desktop assistant (JARVIS/FRIDAY-inspired, no Marvel/Disney assets) for Windows 11 • Electron + React + TypeScript + Vite + SQLite + Python sidecar.

**Current phase: Foundation** — blank secure Electron window + monorepo scaffold + lint/typecheck/test/CI. No HUD/3D/voice/AI yet.

![Platform](https://img.shields.io/badge/platform-Windows%2011-blue)
![Node](https://img.shields.io/badge/node-%3E%3D%2020%20LTS-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Stack

- **Electron 30** + **electron-vite 2** + **Vite 5** + **React 18** + **TypeScript 5 (strict)**
- **ESLint + Prettier + Vitest** (all pass required to mark a phase done)
- **Zod** for tool input validation (in `packages/shared`)
- Monorepo via **npm workspaces** (`apps/desktop`, `packages/shared`)
- **Python sidecar** placeholder (future: Ollama, Whisper, etc.)
- **SQLite** (future: `better-sqlite3` — not installed in foundation to keep native-build fast)

---

## Prerequisites (Windows)

Install these **before** cloning (PowerShell):

| Tool | How to install | Verify |
|------|----------------|--------|
| **Git** | `winget install --id Git.Git -e` or https://git-scm.com/download/win | `git --version` |
| **Node LTS (20.x)** | `winget install --id OpenJS.NodeJS.LTS -e` or https://nodejs.org/en (includes npm 10+) | `node -v` → `v20.x.x`, `npm -v` → `10.x` |
| **Python 3.11+** (for future sidecar) | `winget install --id Python.Python.3.11 -e` or https://www.python.org/downloads/ | `python --version` |
| **Ollama** (future LLM) | https://ollama.com/download → then `ollama pull llama3.1` | `ollama --version` |
| **VS Code** (recommended) | `winget install --id Microsoft.VisualStudioCode -e` | `code --version` |

> Foundation runs without Python/Ollama — they are listed for later phases.

---

## Quick Start (Windows PowerShell)

```powershell
# 1. Clone
git clone https://github.com/pidugu7/nexus-ai-assistant.git
cd nexus-ai-assistant

# 2. Install (npm workspaces — installs root + apps/desktop + packages/shared)
npm install

# 3. Dev — opens blank Electron window "NEXUS AI: foundation OK"
npm run dev

# 4. Quality gates — all must pass
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit (project references)
npm test           # Vitest
npm run build      # electron-vite build (main + preload + renderer)
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Launch Electron in dev (HMR for renderer) → shows "NEXUS AI: foundation OK" |
| `npm run build` | Production build for all workspaces |
| `npm run lint` / `lint:fix` | ESLint (with --fix) |
| `npm run typecheck` | TypeScript strict typecheck (no emit) |
| `npm test` | Vitest run (node env) |
| `npm run format` / `format:check` | Prettier write/check |

---

## Project Structure

```
nexus-ai/
  AGENTS.md                 # permanent project rules
  README.md                 # this file
  .env.example              # env template (no secrets)
  .gitignore                # extended, never replaced
  docs/
    ARCHITECTURE.md         # architecture diagram + assumptions
    PERMISSIONS.md          # permission tiers 0–3
    EVENTS.md               # typed IPC & event bus
    ROADMAP.md              # phased delivery
  apps/desktop/             # Electron app (electron-vite + React + TS)
    electron.vite.config.ts
    src/main/               # main process — secure window, IPC handlers
    src/preload/            # preload — contextBridge (window.nexus)
    src/renderer/           # React UI — shows "NEXUS AI: foundation OK"
  packages/shared/          # shared types: events, tool contracts, channels
  services/sidecar/         # Python sidecar placeholder (README only)
  tests/                    # cross-package integration tests (placeholder)
  .github/workflows/ci.yml  # Windows CI: install → lint → typecheck → test → build
```

---

## Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` in every `BrowserWindow` (see `apps/desktop/src/main/index.ts`)
- All IPC inputs validated with Zod before use.
- Strict CSP: `default-src 'self'; script-src 'self'; ...` (meta + header).
- Only allowlisted folders accessible — text from web/files is data, never instructions.
- No secrets in repo (`.env.example` only).

See `AGENTS.md` §5 and `docs/PERMISSIONS.md` for full rules.

---

## Dependency Policy

Do not add a dependency without stating **why** in the commit/PR body:

> `add: <package> — reason: <one line>`

Current non-obvious deps and reasons:

- `zod` (shared) — runtime validation for tool inputs + permission tiers.
- `jsdom` (root dev) — DOM env for Vitest when testing renderer utils (future).
- `@vitejs/plugin-react` — required by `electron-vite` renderer (React Fast Refresh).

---

## CI

GitHub Actions on `windows-latest`: `npm ci` → `lint` → `typecheck` → `test` → `build` (see `.github/workflows/ci.yml`).

---

## Troubleshooting (Windows)

| Issue | Fix |
|-------|-----|
| `electron` fails to install | Delete `node_modules` + `package-lock.json`, ensure Node 20 LTS, run `npm install` again. Native deps need `npm ci` on CI. |
| White screen in `npm run dev` | Check terminal for `[vite]` or `Electron` errors; verify `src/renderer/index.html` CSP. Try `npm run build` to catch TS errors. |
| `contextIsolation` lint error | Verify `apps/desktop/src/main/index.ts` still has `contextIsolation: true` and `nodeIntegration: false`. |
| `npm run typecheck` fails | Run `npm install` at root — project references need shared pkg installed. |
| PowerShell execution policy | `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` |

---

## License

MIT — see `LICENSE`.

---

*Foundation phase — 2026-10-22 • Next: Engine & Tool Framework (see `docs/ROADMAP.md`).*
