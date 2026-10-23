# HANDOFF — Phase 1 → Phase 2

**Branch:** `arena/5386cded-nexus-ai-assistant` from `main` (Phase 0 merged). Phase 1 HUD shell done.

**What was built:**
- Frameless window (`frame:false`, `1100×680` min, F11 + IPC `nexus:window:*`), `contextIsolation:on`, `nodeIntegration:off`, `sandbox:on`, prod CSP strict (`PROD_CSP`), dev relaxed (`DEV_CSP` via `cspPlugin`).
- Kill-switch `Ctrl+Alt+Shift+K` via `globalShortcut`, emits `system.kill` + log, warns if taken.
- HUD: titlebar (draggable, buttons `no-drag`), top bar (`NEXUS AI`/`OFFLINE (UI ONLY)`/`NOT CONNECTED`/live clock), left nav 8 items (keyboard, active), center `AI CORE (Phase 3)`, right `SYSTEM STATUS` honest `—`/`None`, command bar stub + disabled mic (`Voice arrives in Phase 7`), collapsible log (real entries).
- Tokens in `tokens.css` (near-black, cyan/amber/red, 1px luminous, glow, spacing, radius, `Inter`/`JetBrains Mono` via `@fontsource` — no CDN). `docs/DESIGN.md` reference.
- Motion ≤300 ms via `framer-motion`; `Reduced effects` in Settings (`localStorage` try/catch, `data-reduced` disables glow).
- Responsive grid `200/1fr/280` → 180/240 → 160/220, no overflow at 1366×768 & 1920×1080 (checked via DevTools emulation + min window).
- Stores: `zustand` (nav, settings, log); libs: `formatClock`, `submitCommand`, `storage`.
- IPC/events typed in `packages/shared/src/ipc.ts`/`events.ts`, validated (Zod), `contextBridge` only.
- Tests: `formatClock`, `navStore`, `command`, `settingsPersistence`, `shell.test.tsx` (all regions, no fake numbers). Prod CSP test still passes.

**Deps added (why):**
- `framer-motion` — declarative panel/log motion ≤300 ms; `zustand` — tiny typed state; `@fontsource/*` — local fonts keep CSP `self`; `@testing-library/react` (dev) — component test.

**To run/build:**
```powershell
npm install
npm run lint; npm run typecheck; npm test; npm run build
npm run dev  # frameless NEXUS HUD, F11 toggles, DevTools in dev only
```

**Next (Phase 2):** Tool contract + `nexus:tool:call` permission gate, allowlist `fs.*`, SQLite log, event bus impl. Reuse `NEXUS_IPC`/`NexusEventMap`; center core stays placeholder until Phase 3.

**Warnings:** `electron` needs download on fresh `main` (we use `ELECTRON_SKIP_BINARY_DOWNLOAD=1` in CI sandbox); window only verifiable on Windows host (we checked build + DevTools emulation).
