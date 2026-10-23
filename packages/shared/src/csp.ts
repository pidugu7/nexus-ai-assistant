/**
 * NEXUS AI — Content Security Policies
 *
 * Single source of truth for CSP strings. Both main process (header) and
 * renderer Vite config (meta tag) import from here so strict vs. dev policies
 * never drift.
 *
 * - PROD_CSP: defense-in-depth strict policy — no inline scripts, no remote
 *   origins, no ws:. Used for packaged builds (app.isPackaged === true).
 *   Never add 'unsafe-eval' or ws:// here.
 *
 * - DEV_CSP: relaxed for electron-vite dev only — allows Vite's inline React
 *   Refresh preamble and HMR websocket. Only used when
 *   process.env.ELECTRON_RENDERER_URL is set / app.isPackaged === false.
 */

/**
 * Production CSP — strict. Mirrors the `<meta>` in apps/desktop/src/renderer/index.html
 * and the docs/ARCHITECTURE.md CSP block.
 */
export const PROD_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self';";

/**
 * Development CSP — relaxed for Vite HMR.
 * Allows:
 *  - Vite inline preamble: 'unsafe-inline' + 'unsafe-eval' for script-src
 *  - Vite HMR websocket + dev server fetch: ws://, wss://, http://localhost:*
 */
export const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https://localhost:*;";

/**
 * Helper for tests/docs: returns true if csp is production-strict.
 */
export function isStrictProdCsp(csp: string): boolean {
  return (
    csp.includes("default-src 'self'") &&
    csp.includes("script-src 'self'") &&
    !csp.includes("unsafe-eval") &&
    !csp.includes("ws://") &&
    !csp.includes("wss://")
  );
}
