import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { DevPanel } from "../src/renderer/src/components/DevPanel.js";
import { useLogStore } from "../src/renderer/src/store/logStore.js";
import { useStateStore } from "../src/renderer/src/store/stateStore.js";

function setPackaged(v?: boolean) {
  const w = window as unknown as { __NEXUS_IS_PACKAGED__?: boolean };
  if (v === undefined) delete w.__NEXUS_IS_PACKAGED__;
  else w.__NEXUS_IS_PACKAGED__ = v;
}

describe("DevPanel counter counts only live events, not history", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    useLogStore.setState({ entries: [], collapsed: false });
    useStateStore.setState({ state: "idle" });
    setPackaged(false);
    delete (window as unknown as { nexus?: unknown }).nexus;
  });

  it("shows 0 when history loaded, increments on live events only", async () => {
    // Simulate history loaded from disk: 200 entries
    const history = Array.from({ length: 200 }, (_, i) => ({
      id: `hist-${i}`,
      timestamp: new Date().toISOString(),
      level: "info" as const,
      message: `hist-${i}`,
    }));
    useLogStore.setState({ entries: history, collapsed: false });

    // Mock nexus with live eventHandlers
    let busHandler: ((ev: { type: string }) => void) | null = null;
    let logHandler: ((e: { level: string; message: string }) => void) | null = null;
    let stateHandler: ((p: { from: string; to: string }) => void) | null = null;
    (window as unknown as { nexus: unknown }).nexus = {
      bus: {
        onEvent: vi.fn((cb) => {
          busHandler = cb;
          return () => {
            busHandler = null;
          };
        }),
        publish: vi.fn(() => Promise.resolve({ ok: true })),
      },
      log: {
        onEntry: vi.fn((cb) => {
          logHandler = cb;
          return () => {
            logHandler = null;
          };
        }),
        get: vi.fn(() => Promise.resolve([])),
      },
      state: {
        onChanged: vi.fn((cb) => {
          stateHandler = cb;
          return () => {
            stateHandler = null;
          };
        }),
        get: vi.fn(() => Promise.resolve({ state: "idle" })),
      },
      toast: { onToast: vi.fn(() => () => {}) },
      dev: { isPackaged: false, onToggle: vi.fn(() => () => {}) },
    } as unknown as typeof window.nexus;

    render(<DevPanel open={true} onClose={() => {}} />);

    // Initially, despite 200 history entries, session count should be 0 (live only)
    expect(screen.getByTestId("dev-event-count").textContent).toBe("0");

    // Simulate 2 live events via bus
    act(() => {
      busHandler?.({ type: "voice.listening.started" });
    });
    expect(screen.getByTestId("dev-event-count").textContent).toBe("1");
    // log handler should not increment sessionCount (only bus does), so still 1
    act(() => {
      logHandler?.({ level: "info", message: "voice.listening.started — SIMULATED" });
    });
    expect(screen.getByTestId("dev-event-count").textContent).toBe("1");

    act(() => {
      busHandler?.({ type: "voice.transcript" });
    });
    expect(screen.getByTestId("dev-event-count").textContent).toBe("2");

    // Ensure diagnostics also show live counts, not history
    expect(screen.getByTestId("diag-state-msgs").textContent).toBe("0");
    act(() => {
      stateHandler?.({ from: "idle", to: "listening" });
    });
    expect(screen.getByTestId("diag-state-msgs").textContent).toBe("1");
    // History still 200, but session count is 2, not 200+
    expect(screen.getByTestId("dev-event-count").textContent).toBe("2");
    expect(useLogStore.getState().entries.length).toBe(200); // history untouched by DevPanel counter logic
  });

  it("diagnostics box is dev-only", () => {
    setPackaged(false);
    const { unmount } = render(<DevPanel open={true} onClose={() => {}} />);
    expect(screen.getByTestId("diagnostics")).toBeInTheDocument();
    unmount();

    setPackaged(true);
    render(<DevPanel open={true} onClose={() => {}} />);
    expect(screen.queryByTestId("diagnostics")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dev-panel")).not.toBeInTheDocument();
  });
});
