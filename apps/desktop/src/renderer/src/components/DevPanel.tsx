import { createEvent } from "@nexus/shared";

declare global {
  interface Window {
    __NEXUS_IS_PACKAGED__?: boolean;
  }
}

function publishSim(type: string, payload: unknown) {
  const ev = createEvent(type as never, payload, { source: "simulated" });
  window.nexus?.bus?.publish(ev);
}

export function DevPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  // never render in packaged build
  if (typeof window !== "undefined" && window.__NEXUS_IS_PACKAGED__) return null;
  if (!open) return null;
  const Btn = (props: { label: string; onClick: () => void }) => (
    <button className="dev-btn" onClick={props.onClick} type="button" data-testid={`dev-${props.label.replace(/\s+/g, "-").toLowerCase()}`}>
      {props.label}
    </button>
  );
  return (
    <div className="dev-panel" data-testid="dev-panel" style={{ border: "1px solid var(--amber-border)", padding: 8, background: "var(--bg-panel)", position: "absolute", right: 8, top: 80, zIndex: 50, maxWidth: 320 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong className="font-mono" style={{ fontSize: 11 }}>DEV — SIMULATED EVENTS</strong>
        <button onClick={onClose} aria-label="Close dev panel" type="button">
          ✕
        </button>
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
      <div className="text-muted" style={{ fontSize: 10, marginTop: 8 }}>
        All events labelled SIMULATED. Illegal transitions are rejected with warning and state unchanged.
      </div>
    </div>
  );
}
