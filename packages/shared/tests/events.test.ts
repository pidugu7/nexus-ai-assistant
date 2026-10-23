import { describe, it, expect } from "vitest";
import { NexusEventSchema, createEvent } from "../src/events.js";

describe("event validation", () => {
  it("accepts valid event", () => {
    const ev = createEvent("voice.transcript", { text: "hello", isFinal: true }, { source: "user" });
    expect(NexusEventSchema.safeParse(ev).success).toBe(true);
  });
  it("rejects missing id", () => {
    const ev = { timestamp: new Date().toISOString(), source: "user", type: "voice.transcript", payload: { text: "hi", isFinal: true } };
    expect(NexusEventSchema.safeParse(ev).success).toBe(false);
  });
  it("rejects bad payload type", () => {
    const ev = { id: "1", timestamp: new Date().toISOString(), source: "user", type: "voice.transcript", payload: { text: 123, isFinal: true } };
    expect(NexusEventSchema.safeParse(ev).success).toBe(false);
  });
  it("rejects invalid source", () => {
    const ev = { id: "1", timestamp: new Date().toISOString(), source: "hacker", type: "voice.transcript", payload: { text: "hi", isFinal: true } };
    expect(NexusEventSchema.safeParse(ev).success).toBe(false);
  });
  it("simulated source allowed", () => {
    const ev = createEvent("llm.token", { token: "hi" }, { source: "simulated" });
    expect(ev.source).toBe("simulated");
    expect(NexusEventSchema.safeParse(ev).success).toBe(true);
  });
});
