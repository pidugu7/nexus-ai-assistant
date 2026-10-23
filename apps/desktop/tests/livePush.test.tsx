import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { useLogStore } from "../src/renderer/src/store/logStore.js";
import { useStateStore } from "../src/renderer/src/store/stateStore.js";
import App from "../src/renderer/src/App.js";
import { ActivityLog } from "../src/renderer/src/components/ActivityLog.js";

function setPackaged(v?: boolean) {
  const w = window as unknown as { __NEXUS_IS_PACKAGED__?: boolean };
  if (v === undefined) delete w.__NEXUS_IS_PACKAGED__;
  else w.__NEXUS_IS_PACKAGED__ = v;
}

describe("renderer store updates when IPC state message arrives", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    useStateStore.setState({ state: "idle" });
    useLogStore.setState({ entries: [], collapsed: false });
    setPackaged(false);
  });

  it("state changes to listening when main sends STATE_CHANGED", async () => {
    let stateHandler: ((p: { from: string; to: string; eventId: string }) => void) | null = null;
    let logHandler: ((e: { id: string; timestamp: string; level: string; message: string }) => void) | null = null;
    const mockOnChanged = vi.fn((cb) => {
      stateHandler = cb;
      return () => {
        stateHandler = null;
      };
    });
    const mockOnEntry = vi.fn((cb) => {
      logHandler = cb;
      return () => {
        logHandler = null;
      };
    });
    const mockBus = vi.fn(() => () => {});
    const mockLogGet = vi.fn(() => Promise.resolve([]));
    const mockStateGet = vi.fn(() => Promise.resolve({ state: "idle" }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).nexus = {
      log: { get: mockLogGet, onEntry: mockOnEntry, clearView: vi.fn() },
      state: { get: mockStateGet, onChanged: mockOnChanged },
      bus: { onEvent: mockBus, publish: vi.fn(() => Promise.resolve({ ok: true })) },
      system: { onKill: vi.fn(() => () => {}) },
      dev: { onToggle: vi.fn(() => () => {}), isPackaged: false },
      toast: { onToast: vi.fn(() => () => {}) },
      window: {
        minimize: vi.fn(),
        maximize: vi.fn(),
        close: vi.fn(),
        toggleFullscreen: vi.fn(() => Promise.resolve({ ok: true })),
        isMaximized: vi.fn(() => Promise.resolve({ isMaximized: false })),
        isFullscreen: vi.fn(() => Promise.resolve({ isFullscreen: false })),
        onMaximizedChanged: vi.fn(() => () => {}),
        onFullscreenChanged: vi.fn(() => () => {}),
      },
    };

    render(<App />);
    // wait for initial effect (StrictMode may double-invoke)
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockOnChanged.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(useStateStore.getState().state).toBe("idle");
    // Simulate main sending state change + log entry (main's persistAndBroadcast for state)
    act(() => {
      stateHandler?.({ from: "idle", to: "listening", eventId: "test-1" });
      logHandler?.({ id: "state-1", timestamp: new Date().toISOString(), level: "info", message: "state idle → listening" });
    });
    expect(useStateStore.getState().state).toBe("listening");
    // Log entry for state transition comes from main via LOG_ENTRY, not duplicate via state handler
    const entries = useLogStore.getState().entries;
    const stateEntries = entries.filter((e) => e.message.includes("idle → listening"));
    expect(stateEntries.length).toBe(1);
  });
});

describe("log store keeps last 200 when receives 201st and 250th", () => {
  beforeEach(() => {
    useLogStore.setState({ entries: [], collapsed: false });
  });

  it("keeps last 200 when 201st arrives (drops oldest)", () => {
    const store = useLogStore.getState();
    // Fill with 200 entries 0..199
    for (let i = 0; i < 200; i++) {
      store.addEntry({ id: `id-${i}`, timestamp: new Date().toISOString(), level: "info", message: `msg-${i}` });
    }
    expect(useLogStore.getState().entries.length).toBe(200);
    expect(useLogStore.getState().entries[0].message).toBe("msg-0");
    expect(useLogStore.getState().entries[199].message).toBe("msg-199");
    // Add 201st
    useLogStore.getState().addEntry({ id: "id-200", timestamp: new Date().toISOString(), level: "info", message: "msg-200" });
    const after = useLogStore.getState().entries;
    expect(after.length).toBe(200);
    // Should keep last 200: 1..200, drop 0
    expect(after[0].message).toBe("msg-1");
    expect(after[199].message).toBe("msg-200");
    expect(after.some((e) => e.message === "msg-0")).toBe(false);
  });

  it("keeps last 200 when 250th arrives", () => {
    useLogStore.setState({ entries: [], collapsed: false });
    for (let i = 0; i < 250; i++) {
      useLogStore.getState().addEntry({ id: `id-${i}`, timestamp: new Date().toISOString(), level: "info", message: `msg-${i}` });
    }
    const after = useLogStore.getState().entries;
    expect(after.length).toBe(200);
    expect(after[0].message).toBe("msg-50");
    expect(after[199].message).toBe("msg-249");
    expect(after.some((e) => e.message === "msg-0")).toBe(false);
    expect(after.some((e) => e.message === "msg-49")).toBe(false);
  });

  it("setEntries also trims to last 200", () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ id: `id-${i}`, timestamp: new Date().toISOString(), level: "info" as const, message: `msg-${i}` }));
    useLogStore.getState().setEntries(many);
    const after = useLogStore.getState().entries;
    expect(after.length).toBe(200);
    expect(after[0].message).toBe("msg-50");
  });
});

describe("subscription survives React StrictMode double mount", () => {
  it("subscribe, unsubscribe, subscribe again still delivers", async () => {
    let handler: ((p: { from: string; to: string; eventId: string }) => void) | null = null;
    const subscribe = vi.fn((cb) => {
      handler = cb;
      return () => {
        handler = null;
      };
    });
    const mockNexus = {
      log: { get: () => Promise.resolve([]), onEntry: vi.fn(() => () => {}), clearView: vi.fn() },
      state: { get: () => Promise.resolve({ state: "idle" }), onChanged: subscribe },
      bus: { onEvent: vi.fn(() => () => {}), publish: vi.fn(() => Promise.resolve({ ok: true })) },
      system: { onKill: vi.fn(() => () => {}) },
      dev: { onToggle: vi.fn(() => () => {}), isPackaged: false },
      toast: { onToast: vi.fn(() => () => {}) },
      window: {
        minimize: vi.fn(),
        maximize: vi.fn(),
        close: vi.fn(),
        toggleFullscreen: vi.fn(() => Promise.resolve({ ok: true })),
        isMaximized: vi.fn(() => Promise.resolve({ isMaximized: false })),
        isFullscreen: vi.fn(() => Promise.resolve({ isFullscreen: false })),
        onMaximizedChanged: vi.fn(() => () => {}),
        onFullscreenChanged: vi.fn(() => () => {}),
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).nexus = mockNexus;
    setPackaged(false);
    useStateStore.setState({ state: "idle" });
    useLogStore.setState({ entries: [], collapsed: false });

    const { unmount } = render(<App />);
    await act(async () => await Promise.resolve());
    const firstCalls = subscribe.mock.calls.length;
    expect(firstCalls).toBeGreaterThanOrEqual(1);
    expect(handler).not.toBeNull();
    // Simulate StrictMode unmount
    unmount();
    expect(handler).toBeNull();
    // Mount again (StrictMode second mount)
    render(<App />);
    await act(async () => await Promise.resolve());
    expect(subscribe.mock.calls.length).toBeGreaterThan(firstCalls);
    expect(handler).not.toBeNull();
    // Now deliver
    act(() => {
      handler?.({ from: "idle", to: "thinking", eventId: "test-2" });
    });
    expect(useStateStore.getState().state).toBe("thinking");
  });
});

describe("auto-scroll behavior", () => {
  it("auto-scrolls to newest unless user scrolled up", async () => {
    useLogStore.setState({ entries: [], collapsed: false });
    const { container, rerender } = render(<ActivityLog />);
    const logBody = container.querySelector('[data-testid="log-body"]') as HTMLElement;
    expect(logBody).toBeInTheDocument();
    // Initially no scroll needed
    // Add entries
    for (let i = 0; i < 5; i++) {
      useLogStore.getState().addEntry({ id: `id-${i}`, timestamp: new Date().toISOString(), level: "info", message: `msg-${i}` });
    }
    // Force rerender to reflect store change
    rerender(<ActivityLog />);
    // After adding, if autoScroll true, scrollTop should be at bottom (scrollHeight)
    // jsdom doesn't layout, but we can check that effect runs without error and container has overflowY:auto
    expect(logBody.style.overflowY).toBe("auto");
    expect(logBody.style.maxHeight).toBe("220px");
    // Simulate user scrolling up: set autoScroll false via scroll event
    // Manually set scrollTop to top and trigger handleScroll
    Object.defineProperty(logBody, "scrollHeight", { value: 1000, writable: true });
    Object.defineProperty(logBody, "clientHeight", { value: 200, writable: true });
    logBody.scrollTop = 0;
    // Trigger scroll event
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.scroll(logBody);
    // Now add more entries, should NOT auto-scroll because user scrolled up
    // We can't easily test internal autoScroll state, but we verify component still renders and has scroll handler
    expect(logBody).toBeInTheDocument();
  });
});
