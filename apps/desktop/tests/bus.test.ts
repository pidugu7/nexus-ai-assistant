import { describe, it, expect, vi } from "vitest";
import { TypedEventBus } from "../src/main/eventBus.js";
import { createEvent } from "../../../packages/shared/src/events.js";

describe("event bus", () => {
  it("validates bad payloads rejected", () => {
    const bus = new TypedEventBus();
    const bad = { id: "", timestamp: "x", source: "user", type: "voice.transcript", payload: { text: 123 } };
    const res = bus.publish(bad);
    expect(res.ok).toBe(false);
  });

  it("subscriber error isolation", () => {
    const bus = new TypedEventBus();
    const good = vi.fn();
    bus.subscribe(() => { throw new Error("boom"); });
    bus.subscribe(good);
    const ev = createEvent("voice.listening.started", {}, { source: "user" });
    const res = bus.publish(ev);
    expect(res.ok).toBe(true);
    expect(good).toHaveBeenCalled();
  });

  it("allowlist blocks renderer non-allowlisted", () => {
    const bus = new TypedEventBus();
    const ev = createEvent("voice.listening.started", {}, { source: "user" });
    // this is allowed (in allowlist)
    expect(bus.publish(ev, { fromRenderer: true }).ok).toBe(true);
    // craft a non-allowlisted type by bypassing zod? Use unknown type not in allowlist but still valid schema - use engine:status which is legacy not in allowlist
    const badEv = { id: "1", timestamp: new Date().toISOString(), source: "user", type: "engine:status", payload: {} };
    expect(bus.publish(badEv, { fromRenderer: true }).ok).toBe(false);
  });

  it("unsubscribe works", () => {
    const bus = new TypedEventBus();
    const fn = vi.fn();
    const off = bus.subscribe(fn);
    off();
    bus.publish(createEvent("system.kill", { reason: "x" }, { source: "system" }));
    expect(fn).not.toHaveBeenCalled();
  });
});
