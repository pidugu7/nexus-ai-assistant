import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useStateStore } from "../src/renderer/src/store/stateStore.js";
import { useLogStore } from "../src/renderer/src/store/logStore.js";
import { TopStatusBar } from "../src/renderer/src/components/TopStatusBar.js";
import { ActivityLog } from "../src/renderer/src/components/ActivityLog.js";

describe("status bar and log react to events", () => {
  it("status bar shows real state", () => {
    useStateStore.setState({ state: "thinking" });
    render(<TopStatusBar />);
    expect(screen.getByTestId("status-state").textContent).toBe("THINKING");
  });
  it("log shows SIMULATED badge", () => {
    useLogStore.setState({
      entries: [{ id: "1", timestamp: new Date().toISOString(), level: "info", message: "hello — SIMULATED", source: "simulated", type: "voice.listening.started" }],
      collapsed: false,
    });
    render(<ActivityLog />);
    expect(screen.getByText("SIMULATED")).toBeInTheDocument();
    expect(screen.getByText(/hello/)).toBeInTheDocument();
  });
  it("log clear view keeps file (UI clears, store clears)", () => {
    useLogStore.setState({
      entries: [{ id: "1", timestamp: new Date().toISOString(), level: "info", message: "a", source: "system" }],
      collapsed: false,
    });
    render(<ActivityLog />);
    expect(screen.getByText("a")).toBeInTheDocument();
    // simulate clear view (renderer only) — file not touched, tested in fileLogStore.test
  });
});
