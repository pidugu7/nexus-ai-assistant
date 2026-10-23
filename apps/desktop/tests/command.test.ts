import { describe, it, expect } from "vitest";
import { submitCommand } from "../src/renderer/src/lib/command.js";

describe("command submit stub", () => {
  it("returns command received with trimmed text", () => {
    expect(submitCommand("  hello world  ")).toEqual({ ok: true, message: "command received: hello world" });
  });
  it("handles empty input", () => {
    expect(submitCommand("   ")).toEqual({ ok: false, message: "command received: <empty>" });
    expect(submitCommand("")).toEqual({ ok: false, message: "command received: <empty>" });
  });
});
