import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";
import App from "../src/renderer/src/App.js";

function setPackaged(v?: boolean) {
  const w = window as unknown as { __NEXUS_IS_PACKAGED__?: boolean };
  if (v === undefined) delete w.__NEXUS_IS_PACKAGED__;
  else w.__NEXUS_IS_PACKAGED__ = v;
}

describe("DEV panel — dev-only button and toggle", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
  });
  afterEach(() => {
    setPackaged(undefined);
  });

  it("DEV button toggles panel in dev", () => {
    setPackaged(false);
    render(<App />);
    const btn = screen.getByTestId("dev-button");
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toBe("DEV");
    expect(screen.queryByTestId("dev-panel")).not.toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.getByTestId("dev-panel")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByTestId("dev-panel")).not.toBeInTheDocument();
  });

  it("DEV button and panel do not render when packaged", () => {
    setPackaged(true);
    render(<App />);
    expect(screen.queryByTestId("dev-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dev-panel")).not.toBeInTheDocument();
  });

  it("main shortcut handler uses KeyD with all modifiers and prevents default", () => {
    const mainPath = join(process.cwd(), "apps/desktop/src/main/index.ts");
    const main = readFileSync(mainPath, "utf8");
    // must use code, not key
    expect(main).toContain('input.code === "KeyD"');
    expect(main).toContain("input.control");
    expect(main).toContain("input.alt");
    expect(main).toContain("input.shift");
    expect(main).toContain('input.type === "keyDown"');
    expect(main).toContain("event.preventDefault()");
    expect(main).toContain("DEV_TOGGLE");
    // should send IPC to renderer
    expect(main).toContain("webContents.send");
    // must not use fragile key.toLowerCase() === \"d\"
    expect(main).not.toContain('input.key.toLowerCase() === "d"');
    // also should not use key === \"D\" literal
    expect(main).not.toMatch(/input\.key\s*===?\s*"D"/);
  });

  it("shortcut handler ignores plain d without modifiers", () => {
    const mainPath = join(process.cwd(), "apps/desktop/src/main/index.ts");
    const main = readFileSync(mainPath, "utf8");
    // The condition must require all three modifiers together
    // Look for combined check: code === KeyD && control && alt && shift
    const hasStrict = /input\.code\s*===\s*"KeyD"\s*&&\s*input\.control\s*&&\s*input\.alt\s*&&\s*input\.shift/.test(main);
    expect(hasStrict).toBe(true);
    // Ensure no handler that would match plain \"d\"
    // If code is required, plain d without modifiers cannot trigger because modifiers missing
  });

  it("isDev is passed via preload before render, not injected after load", () => {
    const mainPath = join(process.cwd(), "apps/desktop/src/main/index.ts");
    const main = readFileSync(mainPath, "utf8");
    const preloadPath = join(process.cwd(), "apps/desktop/src/preload/index.ts");
    const preload = readFileSync(preloadPath, "utf8");
    // main must pass via additionalArguments synchronously
    expect(main).toContain("additionalArguments");
    expect(main).toContain("--nexus-is-packaged=");
    expect(main).toContain("app.isPackaged");
    // preload must read process.argv before React renders
    expect(preload).toContain("process.argv");
    expect(preload).toContain("--nexus-is-packaged=");
    expect(preload).toContain('contextBridge.exposeInMainWorld("__NEXUS_IS_PACKAGED__"');
    // must not inject after load (fragile race)
    expect(main).not.toContain("executeJavaScript(`window.__NEXUS_IS_PACKAGED__");
    expect(main).not.toContain("executeJavaScript(\"window.__NEXUS_IS_PACKAGED__");
  });
});
