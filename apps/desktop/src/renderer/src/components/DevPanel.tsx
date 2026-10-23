import { useEffect, useRef, useState } from "react";
import { createEvent } from "@nexus/shared";
import { useStateStore } from "../store/stateStore.js";

declare global {
  interface Window {
    __NEXUS_IS_PACKAGED__?: boolean;
  }
}

const WALK_SEQUENCE: Array<[string, unknown, string]> = [
  ["voice.listening.started", {}, "listening"],
  ["voice.transcript", { text: "hello nexus", isFinal: true }, "thinking"],
  ["tool.started", { tool: "demo.tool", input: {} }, "executing"],
  ["tool.finished", { tool: "demo.tool", output: {} }, "thinking"],
  ["tool.started", { tool: "demo.tool", input: {} }, "executing"],
  ["permission.requested", { tool: "demo.tool", permission: 2, input: {} }, "awaiting_approval"],
  ["permission.resolved", { tool: "demo.tool", granted: true, actor: "user" }, "executing"],
  ["llm.done", { text: "answer" }, "speaking"],
  ["voice.listening.stopped", {}, "idle"],
  ["voice.listening.started", {}, "listening"],
  ["voice.transcript", { text: "walk", isFinal: true }, "thinking"],
  ["system.warning", { message: "simulated warning" }, "warning"],
  ["voice.listening.started", {}, "listening"],
  ["voice.transcript", { text: "walk", isFinal: true }, "thinking"],
  ["llm.error", { message: "simulated error" }, "error"],
  ["system.kill", { reason: "walk done" }, "idle"],
];

export function DevPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [walking, setWalking] = useState(false);
  const walkRef = useRef<number | null>(null);
  const state = useStateStore((s) => s.state);
  const [lastStateUpdate, setLastStateUpdate] = useState<string>("never");
  const [clicksSent, setClicksSent] = useState(0);
  const [stateMsgs, setStateMsgs] = useState(0);
  const [logMsgs, setLogMsgs] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [lastError, setLastError] = useState<string>("none");
  const prevStateRef = useRef(state);

  useEffect(() => {
    if (prevStateRef.current !== state) {
      setLastStateUpdate(new Date().toLocaleTimeString());
      prevStateRef.current = state;
    }
  }, [state]);

  useEffect(() => {
    const nexus = (window as unknown as { nexus?: { state?: { onChanged?: (cb: (p: { from: string; to: string }) => void) => () => void }; bus?: { onEvent?: (cb: (ev: { type: string }) => void) => () => void }; log?: { onEntry?: (cb: (e: { level: string; message: string }) => void) => () => void }; toast?: { onToast?: (cb: (p: { message: string; ok: boolean }) => void) => () => void } } }).nexus;
    const unsubs: (() => void)[] = [];
    if (nexus?.state?.onChanged) {
      unsubs.push(
        nexus.state.onChanged(() => {
          setLastStateUpdate(new Date().toLocaleTimeString());
          setStateMsgs((c) => c + 1);
        })
      );
    }
    if (nexus?.bus?.onEvent) {
      unsubs.push(
        nexus.bus.onEvent(() => {
          setLogMsgs((c) => c + 1);
          setSessionCount((c) => c + 1);
        })
      );
    }
    if (nexus?.log?.onEntry) {
      unsubs.push(
        nexus.log.onEntry((e) => {
          setLogMsgs((c) => c + 1);
          if (e.level === "warn" || e.level === "error" || e.message.includes("REJECTED")) {
            setLastError(`${e.message.slice(0, 80)} @ ${new Date().toLocaleTimeString()}`);
          }
        })
      );
    }
    if (nexus?.toast?.onToast) {
      unsubs.push(
        nexus.toast.onToast((p) => {
          if (!p.ok) setLastError(`${p.message.slice(0, 80)} @ ${new Date().toLocaleTimeString()}`);
        })
      );
    }
    return () => unsubs.forEach((fn) => fn());
  }, []);

  if (typeof window !== "undefined" && window.__NEXUS_IS_PACKAGED__) return null;
  if (!open) return null;

  function publishSim(type: string, payload: unknown) {
    setClicksSent((c) => c + 1);
    try {
      (window as unknown as { __NEXUS_TRACE_CLICKS?: number }).__NEXUS_TRACE_CLICKS =
        ((window as unknown as { __NEXUS_TRACE_CLICKS?: number }).__NEXUS_TRACE_CLICKS ?? 0) + 1;
    } catch (_e) {
      void _e;
    }
    const ev = createEvent(type as never, payload, { source: "simulated" });
    const p = window.nexus?.bus?.publish(ev);
    if (p && typeof (p as Promise<unknown>).then === "function") {
      (p as Promise<{ ok: boolean; reason?: string }>).then((res) => {
        if (!res.ok) {
          setLastError(`${type}: REJECTED ${res.reason} @ ${new Date().toLocaleTimeString()}`);
          console.warn(`[DEV] ${type}: REJECTED because ${res.reason}`);
        }
      });
    }
  }

  const Btn = (props: { label: string; onClick: () => void }) => (
    <button className="dev-btn" onClick={props.onClick} type="button" data-testid={`dev-${props.label.replace(/\s+/g, "-").toLowerCase()}`}>
      {props.label}
    </button>
  );

  const startWalk = () => {
    if (walking) return;
    setWalking(true);
    let idx = 0;
    const tick = () => {
      if (idx >= WALK_SEQUENCE.length) {
        setWalking(false);
        if (walkRef.current) window.clearInterval(walkRef.current);
        walkRef.current = null;
        return;
      }
      const [type, payload] = WALK_SEQUENCE[idx];
      publishSim(type, payload);
      idx++;
    };
    tick();
    walkRef.current = window.setInterval(tick, 1200);
  };

  const stopWalk = () => {
    if (walkRef.current) window.clearInterval(walkRef.current);
    walkRef.current = null;
    setWalking(false);
  };

  return (
    <div className="dev-panel" data-testid="dev-panel" style={{ border: "1px solid var(--amber-border)", padding: 8, background: "var(--bg-panel)", position: "absolute", right: 8, top: 80, zIndex: 50, maxWidth: 320 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong className="font-mono" style={{ fontSize: 11 }}>DEV — SIMULATED EVENTS</strong>
        <button onClick={onClose} aria-label="Close dev panel" type="button">
          ✕
        </button>
      </div>
      <div data-testid="dev-live-indicator" style={{ marginTop: 6, fontSize: 10, lineHeight: 1.4, background: "rgba(0,0,0,0.3)", padding: "4px 6px", borderRadius: 4 }}>
        <div>Last state update received: <span data-testid="dev-last-state-time">{lastStateUpdate}</span> ({state})</div>
        <div>Events received this session: <span data-testid="dev-event-count">{sessionCount}</span></div>
      </div>
      <div data-testid="diagnostics" style={{ marginTop: 6, fontSize: 10, lineHeight: 1.4, background: "rgba(255,193,7,0.08)", border: "1px dashed var(--amber, #f59e0b)", padding: "4px 6px", borderRadius: 4 }}>
        <div style={{ fontWeight: 600 }}>Diagnostics (trace)</div>
        <div>clicks sent: <span data-testid="diag-clicks">{clicksSent}</span></div>
        <div>state messages received: <span data-testid="diag-state-msgs">{stateMsgs}</span></div>
        <div>log messages received: <span data-testid="diag-log-msgs">{logMsgs}</span></div>
        <div>last state received: <span data-testid="diag-last-state">{state}</span> at <span data-testid="diag-last-state-time">{lastStateUpdate}</span></div>
        <div>last error: <span data-testid="diag-last-error">{lastError}</span></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
        <Btn label="listening" onClick={() => publishSim("voice.listening.started", {})} />
        <Btn label="transcript" onClick={() => publishSim("voice.transcript", { text: "hello nexus", isFinal: true })} />
        <Btn label="thinking" onClick={() => publishSim("llm.thinking", { prompt: "test" })} />
        <Btn label="token" onClick={() => publishSim("llm.token", { token: "hi" })} />
        <Btn label="llm done" onClick={() => publishSim("llm.done", { text: "answer" })} />
        <Btn label="tool started" onClick={() => publishSim("tool.started", { tool: "demo.tool", input: {} })} />
        <Btn label="tool finished" onClick={() => publishSim("tool.finished", { tool: "demo.tool", output: {} })} />
        <Btn label="awaiting approval" onClick={() => publishSim("permission.requested", { tool: "demo.tool", permission: 2, input: {} })} />
        <Btn label="approved" onClick={() => publishSim("permission.resolved", { tool: "demo.tool", granted: true, actor: "user" })} />
        <Btn label="denied" onClick={() => publishSim("permission.resolved", { tool: "demo.tool", granted: false, actor: "user" })} />
        <Btn label="executing" onClick={() => publishSim("task.step.started", { step: "step-1" })} />
        <Btn label="speaking" onClick={() => publishSim("llm.done", { text: "spoken" })} />
        <Btn label="warning" onClick={() => publishSim("system.warning", { message: "simulated warning" })} />
        <Btn label="error" onClick={() => publishSim("error", { message: "simulated error" })} />
        <Btn label="kill" onClick={() => publishSim("system.kill", { reason: "dev kill" })} />
        <Btn label="illegal" onClick={() => publishSim("llm.token", { token: "illegal from idle" })} />
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
        <button
          type="button"
          data-testid="dev-walk-all"
          onClick={walking ? stopWalk : startWalk}
          style={{ flex: 1, padding: "6px 8px", fontSize: 11, border: "1px solid var(--amber)", background: walking ? "var(--amber)" : "transparent", color: walking ? "black" : "var(--amber)", borderRadius: 4 }}
        >
          {walking ? "Walking…" : "Walk all states"}
        </button>
      </div>
      <div className="text-muted" style={{ fontSize: 10, marginTop: 8 }}>
        All events labelled SIMULATED. Illegal transitions are rejected with warning and state unchanged.
      </div>
    </div>
  );
}

export { WALK_SEQUENCE };
