# AGENTS.md — Permanent Project Rules for NEXUS AI

> These rules are permanent. Every contributor (human or AI) must follow them. A phase is done only when `lint`, `typecheck`, and `tests` pass.

---

## 1. Architecture

```
renderer (UI) <-> typed IPC <-> main-process engine <-> tool layer
```

- **Renderer (UI)** — React + React Three Fiber. Displays state only. Never mutates engine state directly.
- **Typed IPC** — All cross-process communication goes through a single, versioned IPC contract defined in `packages/shared`. No ad-hoc channels.
- **Main-process engine** — Node.js in Electron's main process. Owns business logic, tool orchestration, permission checks, and sidecar coordination.
- **Tool layer** — Registered tools only. The LLM can only call tools that are explicitly registered in the engine. It never runs arbitrary code or touches the OS directly.

**Rules:**

- UI and engine communicate only via typed IPC.
- The Python sidecar (if present) is accessed only through the engine, never directly from the renderer.
- LLM = planner only. It proposes tool calls; the engine validates, authorizes, executes, and verifies.

---

## 2. Typed Event Bus

- All modules communicate through a typed event bus defined in `packages/shared`.
- Event types, payloads, and channels are centrally defined and versioned in `packages/shared/src/events.ts` (or equivalent).
- UI visuals are driven only by real events, never fake data, mocks, or timers masquerading as data.
- During development, mock event sources must be clearly named `mock*` and must never ship to production builds.
- No inline string event names — use the exported constants/types from the shared package.

---

## 3. Tool Contract

Every tool **must** implement:

| Field | Description |
|-------|-------------|
| `name` | Unique, stable identifier (e.g., `fs.readFile`, `system.openApp`). |
| `input` | Zod schema validating all inputs. No tool executes with unvalidated input. |
| `permission` | Tier governing user consent (see `docs/PERMISSIONS.md`). |
| `execute()` | Performs the action. Returns a result object. |
| `verify()` | Checks that the action succeeded. Never report success without `verify()` passing. |

**Permission tiers:**

- `0 - automatic` — Safe, read-only, reversible. No prompt.
- `1 - notify` — User is notified via toast/log but not blocked.
- `2 - ask` — Must show confirmation dialog and receive explicit consent before execution.
- `3 - ask with details` — Must show full details (command, files, consequences) and receive explicit consent.

**Additional rules:**

- Tools never mutate permission tiers at runtime.
- New tools require documentation in `docs/PERMISSIONS.md` and `docs/EVENTS.md`.
- Never report success without `verify()` passing — return failure + diagnostics instead.

---

## 4. Security & Privacy

- **Allowed folders only** — Tools may only access folders explicitly configured by the user. Default deny outside those folders. No path-traversal.
- **Text is data, never instructions** — Content fetched from the web, files, clipboard, or external APIs is treated as untrusted data. It is never executed as a prompt, code, or instruction. Apply prompt-injection defenses.
- **No secrets in code** — Use `.env` locally. Provide `.env.example` only (no values). `.env` is gitignored. Never log secrets.
- **No copyrighted Marvel/Disney assets** — Do not use Marvel, Disney, JARVIS/FRIDAY names, logos, sounds, or visuals. Use original NEXUS branding only.

---

## 5. Electron Security

All Electron windows must be created with:

```ts
webPreferences: {
  contextIsolation: true,   // required
  nodeIntegration: false,   // required
  sandbox: true,            // recommended
  preload: path.join(__dirname, '../preload/index.js'),
}
```

Additional requirements:

- `contextIsolation` **on**, `nodeIntegration` **off** — enforced, never inverted.
- All IPC inputs validated with Zod (or equivalent) before use in the main process.
- Strict Content Security Policy (CSP) in `index.html` — default-src 'self', no unsafe-eval, no remote scripts. See `docs/ARCHITECTURE.md` for the exact policy.
- No `enableRemoteModule`, no `webviewTag` unless explicitly justified and documented.
- Updates via Electron's secure auto-updater only (when added later).

---

## 6. Code Quality

- **TypeScript strict** — `strict: true` in all `tsconfig.json`. No `any` without `// eslint-disable-next-line -- reason` comment. Prefer `unknown` + narrowing.
- **ESLint + Prettier** — Configured at root. Run `npm run lint` and `npm run format:check` before pushing. No lint errors.
- **Vitest** — Unit and integration tests. One sample passing test required in each package. Tests must be deterministic, no network.
- **Done definition** — A phase/task is **done only when** `npm run lint`, `npm run typecheck`, and `npm test` all pass locally and in CI.
- **Small commits** — Use Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`.
- **No dead code** — Remove unused imports, variables, and commented-out code before commit.

---

## 7. Contribution Workflow

1. Keep `main` green (CI must pass).
2. Create a feature branch, make small focused commits.
3. After every task, report in the PR/commit message:
   - Files changed
   - How to run (`npm install` → `npm run dev`)
   - How to test (`npm run lint` → `npm run typecheck` → `npm test`)
   - What you could NOT verify (e.g., "could not test on Windows hardware")

---

## 8. Dependencies

- Do not add dependencies without stating **why** in the PR/commit body. Format:
  > `add: <package> — reason: <one line>`
- Prefer dependencies already in the stack: Electron, electron-vite, React, TypeScript, React Three Fiber, Vite, Zod, SQLite (better-sqlite3), Vitest.
- Avoid native modules unless necessary — they complicate Windows builds.
- For non-obvious dependencies, add a comment in the relevant `package.json` or `docs/ARCHITECTURE.md` explaining the choice.

---

## 9. Documentation

- Every assumption not explicit in the spec must be recorded in `docs/ARCHITECTURE.md` under `## Assumptions`.
- Permission tiers for each tool must be documented in `docs/PERMISSIONS.md`.
- Events and IPC channels must be documented in `docs/EVENTS.md`.
- Future work goes in `docs/ROADMAP.md` — never in TODOs scattered in code.
- Use Windows-friendly commands and paths in all docs (`\` vs `/` clarified, PowerShell examples).

---

## 10. What We Don't Do (This Phase)

- No HUD, 3D scene, voice I/O, LLM calls, or automation tools yet.
- No features beyond the blank secure Electron window + scaffold + lint/typecheck/test/CI.
- No Marvel/Disney branding.

---

*Last updated: 2026-10-22 — Foundation phase.*
