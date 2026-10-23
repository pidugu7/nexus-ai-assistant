import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { PROD_CSP, DEV_CSP, isStrictProdCsp } from "../src/csp.js";

describe("NEXUS CSP — production stays strict", () => {
  it("production CSP matches documented strict policy", () => {
    // Must match docs/ARCHITECTURE.md and apps/desktop/src/renderer/index.html
    expect(PROD_CSP).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self';"
    );
  });

  it("production CSP never allows unsafe-eval or websocket", () => {
    expect(PROD_CSP).not.toContain("unsafe-eval");
    expect(PROD_CSP).not.toContain("ws://");
    expect(PROD_CSP).not.toContain("wss://");
    expect(PROD_CSP).not.toContain("blob:");
    expect(isStrictProdCsp(PROD_CSP)).toBe(true);
  });

  it("dev CSP allows Vite HMR (unsafe-inline, unsafe-eval, ws/wss)", () => {
    expect(DEV_CSP).toContain("unsafe-inline");
    expect(DEV_CSP).toContain("unsafe-eval");
    expect(DEV_CSP).toContain("ws://localhost:*");
    expect(DEV_CSP).toContain("wss://localhost:*");
    expect(DEV_CSP).toContain("http://localhost:*");
    expect(isStrictProdCsp(DEV_CSP)).toBe(false);
  });

  it("main process production CSP is strict (file check)", () => {
    // Ensure apps/desktop/src/main/index.ts still enforces strict prod header
    const mainPath = join(process.cwd(), "apps/desktop/src/main/index.ts");
    const main = readFileSync(mainPath, "utf8");
    // The file must define PROD_CSP with strict value
    expect(main).toContain(PROD_CSP);
    // And must define DEV_CSP with relaxed value
    expect(main).toContain(DEV_CSP);
    // Must choose header based on !app.isPackaged / ELECTRON_RENDERER_URL
    expect(main).toContain("!app.isPackaged");
    expect(main).toContain("ELECTRON_RENDERER_URL");
    // Must keep security flags
    expect(main).toContain("contextIsolation: true");
    expect(main).toContain("nodeIntegration: false");
    expect(main).toContain("sandbox: true");
  });

  it("renderer index.html meta stays strict in repo", () => {
    const htmlPath = join(process.cwd(), "apps/desktop/src/renderer/index.html");
    const html = readFileSync(htmlPath, "utf8");
    // Prod meta must be strict
    expect(html).toContain(`content="${PROD_CSP}"`);
    // And must not already be relaxed
    // (dev relaxation happens at Vite transformIndexHtml runtime, not in repo file)
    expect(html).not.toContain("unsafe-eval");
    expect(html).not.toContain("ws://localhost");
  });

  it("vite config swaps CSP for dev server only", () => {
    const viteConfigPath = join(process.cwd(), "apps/desktop/electron.vite.config.ts");
    const viteConfig = readFileSync(viteConfigPath, "utf8");
    expect(viteConfig).toContain("cspPlugin");
    expect(viteConfig).toContain("transformIndexHtml");
    // Must replace PROD_CSP with DEV_CSP when ctx.server is truthy
    expect(viteConfig).toContain("ctx.server");
    expect(viteConfig).toContain(PROD_CSP);
    expect(viteConfig).toContain(DEV_CSP);
  });

  it("dev-tools auto-open only in dev", () => {
    const mainPath = join(process.cwd(), "apps/desktop/src/main/index.ts");
    const main = readFileSync(mainPath, "utf8");
    expect(main).toContain("openDevTools");
    // Should be gated by isDev
    expect(main).toMatch(/if\s*\(\s*isDev\s*\)\s*\{[^}]*openDevTools/);
  });
});
