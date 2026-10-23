import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/renderer/src/App.js";
import { useLogStore } from "../src/renderer/src/store/logStore.js";

describe("HUD shell — all regions", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    useLogStore.setState({ entries: [], collapsed: false });
  });
  it("renders titlebar, statusbar, nav, core, right panel, command bar, log", () => {
    render(<App />);

    // Titlebar
    expect(screen.getByTestId("titlebar")).toBeInTheDocument();
    expect(screen.getAllByText("NEXUS AI").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText("Minimize")).toBeInTheDocument();
    expect(screen.getByLabelText("Close")).toBeInTheDocument();

    // Top status bar
    expect(screen.getByTestId("statusbar")).toBeInTheDocument();
    expect(screen.getByText("OFFLINE (UI ONLY)")).toBeInTheDocument();
    expect(screen.getByText("NOT CONNECTED")).toBeInTheDocument();
    expect(screen.getByTestId("clock")).toBeInTheDocument();

    // Left nav
    expect(screen.getByTestId("leftnav")).toBeInTheDocument();
    ["Home","Projects","Research","Engineering","Files","Automation","Memory","Settings"].forEach(n=>{
      expect(screen.getByTestId(`nav-${n.toLowerCase()}`)).toBeInTheDocument();
    });
    // active highlight defaults to Home
    expect(screen.getByTestId("nav-home")).toHaveAttribute("aria-selected","true");

    // Center AI core placeholder
    expect(screen.getByTestId("center-core")).toBeInTheDocument();
    expect(screen.getByText("AI CORE (Phase 3)")).toBeInTheDocument();

    // Right panel — honest UI: — and None, no fake numbers
    expect(screen.getByTestId("right-panel")).toBeInTheDocument();
    expect(screen.getByText("SYSTEM STATUS")).toBeInTheDocument();
    ["CPU","GPU","RAM","NETWORK"].forEach(label=>{
      const row = screen.getByText(label).closest(".panel-row");
      expect(row).toBeInTheDocument();
      expect(row!.textContent).toContain("—");
      expect(row!.textContent).not.toMatch(/\d+%/);
    });
    expect(screen.getByText("ACTIVE TASK:")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();

    // Command bar
    expect(screen.getByTestId("commandbar")).toBeInTheDocument();
    expect(screen.getByTestId("command-input")).toBeInTheDocument();
    const mic = screen.getByTestId("mic-button");
    expect(mic).toBeDisabled();
    expect(mic).toHaveAttribute("title","Voice arrives in Phase 7");

    // Activity log collapsible
    expect(screen.getByTestId("activity-log")).toBeInTheDocument();
    expect(screen.getByText("ACTIVITY LOG")).toBeInTheDocument();

    // No fake numeric data anywhere
    expect(document.body.textContent).not.toMatch(/CPU.*\d+%/);
    expect(document.body.textContent).not.toMatch(/\d+\s*GB/);
  });

  it("nav items are keyboard accessible", () => {
    render(<App />);
    const btn = screen.getByTestId("nav-projects");
    expect(btn).toHaveAttribute("tabIndex","0");
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });
});
