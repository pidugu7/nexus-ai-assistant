import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { TypedEventBus } from "../src/main/eventBus.js";
import { createMachine, nextState } from "@nexus/shared";
import { createEvent, NexusEventSchema, RENDERER_PUBLISH_ALLOWLIST } from "@nexus/shared";
import { useStateStore } from "../src/renderer/src/store/stateStore.js";
import { useLogStore } from "../src/renderer/src/store/logStore.js";
import App from "../src/renderer/src/App.js";

// Fake main-process bus + state machine + IPC simulation (no Electron)
// Simulates main's persistAndBroadcast + handleStateTransition correctly: one log entry per event and one per state change
function createFakeMain(ipcListeners?: Map<string, Set<(...args: unknown[]) => void>>) {
  const bus = new TypedEventBus();
  const machine = createMachine("idle");
  const listeners = new Map<string, Set<(event: unknown, payload: unknown) => void>>();
  const on = (channel: string, handler: (event: unknown, payload: unknown) => void) => {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel)!.add(handler);
    return () => listeners.get(channel)!.delete(handler);
  };
  const send = (channel: string, payload: unknown) => {
    const set = listeners.get(channel);
    if (set) {
      for (const h of set) h({}, payload);
    }
    if (ipcListeners) {
      const extSet = ipcListeners.get(channel);
      if (extSet) {
        for (const h of extSet) h({}, payload);
      }
    }
  };

  async function handlePublish(raw: unknown) {
    const parsed = NexusEventSchema.safeParse(raw);
    if (!parsed.success) {
      const reason = parsed.error.issues.map((i) => i.message).join("; ");
      return { ok: false as const, reason };
    }
    const ev = parsed.data as { source: string; type: string; payload: unknown; id: string };
    if (ev.source === "simulated" && !RENDERER_PUBLISH_ALLOWLIST.includes(ev.type as never)) {
      const reason = `Renderer not allowed to publish ${ev.type}`;
      return { ok: false as const, reason };
    }
    const res = bus.publish(raw, { fromRenderer: true });
    if (!res.ok) {
      return { ok: false as const, reason: res.reason };
    }
    const from = machine.getState();
    const nxt = nextState(from, res.event.type, res.event.payload);
    // persistAndBroadcast for original event: bus + log
    send("nexus:bus:event", res.event);
    send("nexus:log:entry", { id: res.event.id, timestamp: res.event.timestamp, level: "info", message: `${res.event.type} — SIMULATED`, source: res.event.source, type: res.event.type });
    if (nxt !== null) {
      const tr = machine.transition({ type: res.event.type, payload: res.event.payload });
      if (tr.ok) {
        send("nexus:state:changed", { from: tr.from, to: tr.to, eventId: res.event.id });
        // main's handleStateTransition also persists state change as log entry
        send("nexus:log:entry", { id: `${Date.now()}-state`, timestamp: new Date().toISOString(), level: "info", message: `state ${tr.from} → ${tr.to}`, source: "system", type: `state:${tr.from}->${tr.to}` });
      }
    } else if (res.event.type === "system.kill" || res.event.type === "error") {
      const tr = machine.transition({ type: res.event.type, payload: res.event.payload });
      if (tr.ok) send("nexus:state:changed", { from: (tr as { from: string }).from, to: (tr as { to: string }).to, eventId: res.event.id });
    }
    return { ok: true as const };
  }

  return { bus, machine, on, send, handlePublish };
}

describe("round trip without Electron", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    useStateStore.setState({ state: "idle" });
    useLogStore.setState({ entries: [], collapsed: false });
    delete (window as unknown as { nexus?: unknown }).nexus;
    delete (window as unknown as { __NEXUS_IS_PACKAGED__?: unknown }).__NEXUS_IS_PACKAGED__;
  });

  it("publishing an event updates the store (proves isolated path works)", async () => {
    const ipcListeners = new Map<string, Set<(...args: unknown[]) => void>>();
    const fakeMain = createFakeMain(ipcListeners);

    const mockIpcRenderer = {
      invoke: async (channel: string, payload: unknown) => {
        if (channel === "nexus:bus:publish") {
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

    const mockNexus = {
      log: {
        get: (count?: number) => mockIpcRenderer.invoke("nexus:log:get", { count }) as Promise<unknown[]>,
        onEntry: (cb: (entry: { id: string; timestamp: string; level: string; message: string }) => void) => {
          const handler = (_: unknown, entry: unknown) => {
            cb(entry as never);
          };
          mockIpcRenderer.on("nexus:log:entry", handler as never);
          return () => mockIpcRenderer.removeListener("nexus:log:entry", handler as never);
        },
        clearView: () => Promise.resolve({ ok: true }),
      },
      bus: {
        publish: (event: unknown) => {
          return mockIpcRenderer.invoke("nexus:bus:publish", event) as Promise<{ ok: boolean; reason?: string }>;
        },
        onEvent: (cb: (ev: { id: string; timestamp: string; source: string; type: string; payload: unknown; level?: string; message?: string }) => void) => {
          const handler = (_: unknown, ev: unknown) => {
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

    const { unmount } = render(<App />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(useStateStore.getState().state).toBe("idle");
    // Core fallback may log WebGL warning in jsdom – clear before asserting
    useLogStore.setState({ entries: [], collapsed: false });
    expect(useLogStore.getState().entries.length).toBe(0);

    const ev = createEvent("voice.listening.started", {}, { source: "simulated" });
    const res = await mockNexus.bus.publish(ev);
    expect(res.ok).toBe(true);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const state = useStateStore.getState().state;
    const entries = useLogStore.getState().entries;

    expect(state).toBe("listening");
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.type === "voice.listening.started")).toBe(true);

    unmount();
  });

  it("one valid event produces exactly one state-change log entry (no duplicate)", async () => {
    const ipcListeners = new Map<string, Set<(...args: unknown[]) => void>>();
    const fakeMain = createFakeMain(ipcListeners);

    const mockIpcRenderer = {
      invoke: async (channel: string, payload: unknown) => {
        if (channel === "nexus:bus:publish") return fakeMain.handlePublish(payload);
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

    const mockNexus = {
      log: {
        get: (count?: number) => mockIpcRenderer.invoke("nexus:log:get", { count }) as Promise<unknown[]>,
        onEntry: (cb: (entry: { id: string; timestamp: string; level: string; message: string }) => void) => {
          const handler = (_: unknown, entry: unknown) => cb(entry as never);
          mockIpcRenderer.on("nexus:log:entry", handler as never);
          return () => mockIpcRenderer.removeListener("nexus:log:entry", handler as never);
        },
        clearView: () => Promise.resolve({ ok: true }),
      },
      bus: {
        publish: (event: unknown) => mockIpcRenderer.invoke("nexus:bus:publish", event) as Promise<{ ok: boolean; reason?: string }>,
        onEvent: (cb: (ev: { id: string; timestamp: string; source: string; type: string; payload: unknown }) => void) => {
          const handler = (_: unknown, ev: unknown) => cb(ev as never);
          mockIpcRenderer.on("nexus:bus:event", handler as never);
          return () => mockIpcRenderer.removeListener("nexus:bus:event", handler as never);
        },
      },
      state: {
        get: () => mockIpcRenderer.invoke("nexus:state:get", {}) as Promise<{ state: string }>,
        onChanged: (cb: (p: { from: string; to: string; eventId: string }) => void) => {
          const handler = (_: unknown, p: unknown) => cb(p as never);
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

    const { unmount } = render(<App />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const ev = createEvent("voice.listening.started", {}, { source: "simulated" });
    await mockNexus.bus.publish(ev);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const entries = useLogStore.getState().entries;
    const stateEntries = entries.filter((e) => e.message === "state idle → listening");
    expect(stateEntries.length).toBe(1);

    unmount();
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
