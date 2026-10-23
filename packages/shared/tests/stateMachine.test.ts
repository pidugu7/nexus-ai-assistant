import { describe, it, expect } from "vitest";
import { createMachine, ALL_STATES } from "../src/stateMachine.js";

describe("state machine valid transitions", () => {
  it("idle -> listening -> thinking -> executing -> speaking -> idle", () => {
    const m = createMachine("idle");
    expect(m.transition({ type: "voice.listening.started", payload: {} }).ok).toBe(true);
    expect(m.getState()).toBe("listening");
    expect(m.transition({ type: "voice.transcript", payload: { text: "hi", isFinal: true } }).ok).toBe(true);
    expect(m.getState()).toBe("thinking");
    expect(m.transition({ type: "llm.done", payload: { text: "out" } }).ok).toBe(true);
    expect(m.getState()).toBe("executing");
    expect(m.transition({ type: "llm.done", payload: { text: "speak" } }).ok).toBe(true);
    expect(m.getState()).toBe("speaking");
    expect(m.transition({ type: "voice.listening.stopped", payload: {} }).ok).toBe(true);
    expect(m.getState()).toBe("idle");
  });

  it("thinking llm.token stays thinking", () => {
    const m = createMachine("thinking");
    expect(m.transition({ type: "llm.token", payload: { token: "hi" } }).ok).toBe(true);
    expect(m.getState()).toBe("thinking");
  });

  it("permission requested/resolved", () => {
    const m = createMachine("executing");
    expect(m.transition({ type: "permission.requested", payload: { tool: "t", permission: 2, input: {} } }).ok).toBe(true);
    expect(m.getState()).toBe("awaiting_approval");
    expect(m.transition({ type: "permission.resolved", payload: { tool: "t", granted: true, actor: "user" } }).ok).toBe(true);
    expect(m.getState()).toBe("executing");
    m.transition({ type: "permission.requested", payload: { tool: "t", permission: 2, input: {} } });
    expect(m.transition({ type: "permission.resolved", payload: { tool: "t", granted: false, actor: "user" } }).ok).toBe(true);
    expect(m.getState()).toBe("thinking");
  });

  it("kill from every state returns idle", () => {
    for (const s of ALL_STATES) {
      const m = createMachine(s as never);
      const res = m.transition({ type: "system.kill", payload: { reason: "test" } });
      expect(res.ok).toBe(true);
      expect(m.getState()).toBe("idle");
    }
  });

  it("error from any via error event", () => {
    const m = createMachine("thinking");
    expect(m.transition({ type: "error", payload: { message: "boom" } }).ok).toBe(true);
    expect(m.getState()).toBe("error");
  });
});

describe("illegal transitions", () => {
  const cases: [string, string][] = [
    ["idle", "llm.token"],
    ["idle", "llm.done"],
    ["idle", "tool.started"],
    ["listening", "llm.done"],
    ["executing", "voice.listening.started"],
    ["idle", "permission.requested"],
    ["speaking", "permission.requested"],
    ["error", "tool.finished"],
    ["awaiting_approval", "tool.started"],
  ];
  it.each(cases)("rejects %s --%s--> ?", (from, type) => {
    const m = createMachine(from as never);
    const res = m.transition({ type, payload: {} });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("Illegal");
    expect(m.getState()).toBe(from);
  });
});
