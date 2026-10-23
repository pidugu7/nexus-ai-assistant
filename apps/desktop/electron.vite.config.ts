import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Keep in sync with packages/shared/src/csp.ts and src/main/index.ts
const PROD_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self';";
const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https://localhost:*;";

/**
 * CSP meta handler:
 * - Production (build): keep strict CSP from index.html (PROD_CSP).
 * - Development (serve): relax CSP to allow Vite HMR (inline + ws).
 * This fixes the blank page in `npm run dev` where strict CSP blocked
 * Vite's inline React Refresh preamble and the HMR websocket.
 */
function cspPlugin() {
  return {
    name: "nexus-csp",
    transformIndexHtml(html: string, ctx: { server?: unknown }) {
      const isServe = !!ctx.server;
      if (isServe) {
        // Replace strict CSP with dev-relaxed CSP when Vite dev server is running
        return html.replace(PROD_CSP, DEV_CSP);
      }
      // Build: ensure prod CSP is present (defense-in-depth with header)
      return html;
    }
  };
}

// https://electron-vite.org/config/
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/main"
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload"
    }
  },
  renderer: {
    root: "src/renderer",
    plugins: [react(), cspPlugin()],
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/renderer/index.html")
        }
      }
    }
  }
});
