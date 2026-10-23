import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { TypedEventBus } from "../src/main/eventBus.js";
import { createMachine, nextState } from "@nexus/shared";
import { createEvent, NexusEventSchema, RENDERER_PUBLISH_ALLOWLIST } from "@nexus/shared";
import { useStateStore } from "../src/renderer/src/store/stateStore.js";
import { useLogStore } from "../src/renderer/src/store/logStore.js";
import App from "../src/renderer/src/App.js";

// Fake main-process bus + state machine + IPC simulation (no Electron)
function createFakeMain(ipcListeners?: Map<string, Set<(...args: unknown[]) => void>>) {
  const bus = new TypedEventBus();
  const machine = createMachine("idle");
  // Simulate main's webContents.send -> preload ipcRenderer handlers
  // We'll use a simple event emitter to simulate IPC channels
  const listeners = new Map<string, Set<(event: unknown, payload: unknown) => void>>();
  const on = (channel: string, handler: (event: unknown, payload: unknown) => void) => {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel)!.add(handler);
    return () => listeners.get(channel)!.delete(handler);
  };
  const send = (channel: string, payload: unknown) => {
    // TRACE HOP 6 simulation
    // In real main this is webContents.send(channel, payload)
    const set = listeners.get(channel);
    if (set) {
      for (const h of set) h({}, payload);
    }
    // Also notify external ipcListeners (mockIpcRenderer) to simulate webContents.send -> preload
    if (ipcListeners) {
      const extSet = ipcListeners.get(channel);
      if (extSet) {
        for (const h of extSet) h({}, payload);
      }
    }
  };

  // Fake main's BUS_PUBLISH handler (simplified from main/index.ts)
  async function handlePublish(raw: unknown) {
    // HOP 3
    console.log(`[HOP 3] main: the IPC handler receives it ${JSON.stringify(raw).slice(0,100)}`);
    const parsed = NexusEventSchema.safeParse(raw);
    if (!parsed.success) {
      const reason = parsed.error.issues.map((i) => i.message).join("; ");
      console.log(`[HOP 4] main: validation result rejected ${reason}`);
      return { ok: false as const, reason };
    }
    const ev = parsed.data as { source: string; type: string; payload: unknown; id: string };
    console.log(`[HOP 4] main: validation result accepted ${ev.type} allowlist=${RENDERER_PUBLISH_ALLOWLIST.includes(ev.type as never)}`);
    if (ev.source === "simulated" && !RENDERER_PUBLISH_ALLOWLIST.includes(ev.type as never)) {
      const reason = `Renderer not allowed to publish ${ev.type}`;
      console.log(`[HOP 4] main: validation result rejected ${reason}`);
      return { ok: false as const, reason };
    }
    const res = bus.publish(raw, { fromRenderer: true });
    if (!res.ok) {
      console.log(`[HOP 4] main: validation result rejected ${res.reason}`);
      return { ok: false as const, reason: res.reason };
    }
    // HOP 5 state machine
    const from = machine.getState();
    const nxt = nextState(from, res.event.type, res.event.payload);
    console.log(`[HOP 5] main: state machine result from=${from} next=${nxt} ${!res ? "reject" : ""}`);
    // Simulate persistAndBroadcast: send to renderer
    send("nexus:bus:event", res.event);
    send("nexus:log:entry", { id: res.event.id, timestamp: res.event.timestamp, level: "info", message: `${res.event.type} — SIMULATED`, source: res.event.source, type: res.event.type });
    if (nxt !== null) {
      const tr = machine.transition({ type: res.event.type, payload: res.event.payload });
      if (tr.ok) {
        console.log(`[HOP 5] main: state machine result old state ${tr.from}, new state ${tr.to}`);
        send("nexus:state:changed", { from: tr.from, to: tr.to, eventId: res.event.id });
      } else {
        console.log(`[HOP 5] main: state machine result rejection ${tr.reason}`);
      }
    } else if (res.event.type === "system.kill" || res.event.type === "error") {
      // handle kill/error
      const tr = machine.transition({ type: res.event.type, payload: res.event.payload });
      if (tr.ok) send("nexus:state:changed", { from: (tr as { from: string }).from, to: (tr as { to: string }).to, eventId: res.event.id });
    }
    // HOP 6
    console.log(`[HOP 6] main: webContents.send is called: nexus:bus:event windows=1 isDestroyed=false`);
    console.log(`[HOP 6] main: webContents.send is called: nexus:log:entry windows=1 isDestroyed=false`);
    return { ok: true as const };
  }

  return { bus, machine, on, send, handlePublish };
}

describe("TRACE round trip without Electron", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    useStateStore.setState({ state: "idle" });
    useLogStore.setState({ entries: [], collapsed: false });
    // Clear any previous window.nexus
    delete (window as unknown as { nexus?: unknown }).nexus;
    delete (window as unknown as { __NEXUS_IS_PACKAGED__?: unknown }).__NEXUS_IS_PACKAGED__;
  });

  it("publishing an event updates the store (proves isolated path works)", async () => {
    const ipcListeners = new Map<string, Set<(...args: unknown[]) => void>>();
    const fakeMain = createFakeMain(ipcListeners);

    // Mock window.nexus to use fake main + real preload subscription code (simplified)
    const mockIpcRenderer = {
      invoke: async (channel: string, payload: unknown) => {
        if (channel === "nexus:bus:publish") {
          // HOP 2
          console.log(`[HOP 2] preload: the publish IPC call is sent ${(payload as { type?: string })?.type}`);
          return fakeMain.handlePublish(payload);
        }
        if (channel === "nexus:log:get") return [];
        if (channel === "nexus:state:get") return { state: fakeMain.machine.getState() };
        return { ok: true };
      },
      on: (channel: string, handler: (...args: unknown[]) => void) => {
        if (!ipcListeners.has(channel)) ipcListeners.set(channel, new Set());
        ipcListeners.get(channel)!.add(handler);
      },
      removeListener: (channel: string, handler: (...args: unknown[]) => void) => {
        ipcListeners.get(channel)?.delete(handler);
      },
    };

    // Note: fakeMain.send already notifies ipcListeners (wired via createFakeMain), no extra patch needed

    // Build mock nexus using real preload wrapper logic (with HOP 7 already)
    const mockNexus = {
      log: {
        get: (count?: number) => mockIpcRenderer.invoke("nexus:log:get", { count }) as Promise<unknown[]>,
        onEntry: (cb: (entry: { id: string; timestamp: string; level: string; message: string }) => void) => {
          const handler = (_: unknown, entry: unknown) => {
            console.log(`[HOP 7] preload: a message arrives on the log channel and the renderer callback is invoked`);
            cb(entry as never);
          };
          mockIpcRenderer.on("nexus:log:entry", handler as never);
          return () => mockIpcRenderer.removeListener("nexus:log:entry", handler as never);
        },
        clearView: () => Promise.resolve({ ok: true }),
      },
      bus: {
        publish: (event: unknown) => {
          console.log(`[HOP 2] preload: the publish IPC call is sent ${(event as { type?: string })?.type}`);
          return mockIpcRenderer.invoke("nexus:bus:publish", event) as Promise<{ ok: boolean; reason?: string }>;
        },
        onEvent: (cb: (ev: { id: string; timestamp: string; source: string; type: string; payload: unknown; level?: string; message?: string }) => void) => {
          const handler = (_: unknown, ev: unknown) => {
            console.log(`[HOP 7] preload: a message arrives on the state channel and the renderer callback is invoked`);
            cb(ev as never);
          };
          mockIpcRenderer.on("nexus:bus:event", handler as never);
          return () => mockIpcRenderer.removeListener("nexus:bus:event", handler as never);
        },
      },
      state: {
        get: () => mockIpcRenderer.invoke("nexus:state:get", {}) as Promise<{ state: string }>,
        onChanged: (cb: (p: { from: string; to: string; eventId: string }) => void) => {
          const handler = (_: unknown, p: unknown) => {
            console.log(`[HOP 7] preload: a message arrives on the state channel and the renderer callback is invoked`);
            cb(p as never);
          };
          mockIpcRenderer.on("nexus:state:changed", handler as never);
          return () => mockIpcRenderer.removeListener("nexus:state:changed", handler as never);
        },
      },
      system: { onKill: () => () => {} },
      dev: { isPackaged: false, onToggle: () => () => {} },
      toast: { onToast: () => () => {} },
      window: {
        minimize: () => Promise.resolve({ ok: true }),
        maximize: () => Promise.resolve({ ok: true }),
        close: () => Promise.resolve({ ok: true }),
        toggleFullscreen: () => Promise.resolve({ ok: true }),
        isMaximized: () => Promise.resolve({ isMaximized: false }),
        isFullscreen: () => Promise.resolve({ isFullscreen: false }),
        onMaximizedChanged: () => () => {},
        onFullscreenChanged: () => () => {},
      },
    };
    (window as unknown as { nexus: unknown }).nexus = mockNexus;
    (window as unknown as { __NEXUS_IS_PACKAGED__: boolean }).__NEXUS_IS_PACKAGED__ = false;

    // Render App which subscribes using real store logic (HOP 8, HOP 9)
    const { unmount } = render(<App />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Verify initial state
    expect(useStateStore.getState().state).toBe("idle");
    expect(useLogStore.getState().entries.length).toBe(0);

    // HOP 1: simulate DevPanel click
    const ev = createEvent("voice.listening.started", {}, { source: "simulated" });
    console.log(`[HOP 1] renderer: button click handler runs, with the event type ${ev.type}`);
    const res = await mockNexus.bus.publish(ev);
    expect(res.ok).toBe(true);

    // Allow async IPC to propagate
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // HOP 8 and 9 should have fired: store should be updated
    const state = useStateStore.getState().state;
    const entries = useLogStore.getState().entries;

    console.log(`[HOP 8] renderer store: setState / appendLog called with the new value ${state} entries=${entries.length}`);
    console.log(`[HOP 9] renderer: the status bar component renders with the state it received ${state}`);

    // Assertions: This test reproduces whole round trip without Electron
    // On CURRENT code (after StrictMode fix and log slice fix), this SHOULD PASS
    // If it fails, the bug is in this isolated path (validation, allowlist, state machine, store slice)
    // If it passes, the bug is outside (subscription never registered, stale window, etc.)
    expect(state).toBe("listening");
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.type === "voice.listening.started")).toBe(true);

    unmount();

    // Report result clearly
    console.log(`[TRACE TEST] RESULT: PASSED — isolated round trip works, problem is outside this path (likely subscription never registered due to StrictMode double-mount or stale window)`);
  });

  it("log store keeps last 200 not first 200 (would fail before fix)", () => {
    useLogStore.setState({ entries: [], collapsed: false });
    for (let i = 0; i < 201; i++) {
      useLogStore.getState().addEntry({ id: `id-${i}`, timestamp: new Date().toISOString(), level: "info", message: `msg-${i}` });
    }
    const after201 = useLogStore.getState().entries;
    expect(after201.length).toBe(200);
    expect(after201[0].message).toBe("msg-1");
    expect(after201[199].message).toBe("msg-200");

    for (let i = 201; i < 250; i++) {
      useLogStore.getState().addEntry({ id: `id-${i}`, timestamp: new Date().toISOString(), level: "info", message: `msg-${i}` });
    }
    const after250 = useLogStore.getState().entries;
    expect(after250.length).toBe(200);
    expect(after250[0].message).toBe("msg-50");
    expect(after250[199].message).toBe("msg-249");
  });
});
