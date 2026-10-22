import { describe, it, expect } from "vitest";
import { NEXUS_VERSION, PermissionTier, validateToolInput } from "../src/index.js";
import { z } from "zod";

describe("@nexus/shared foundation", () => {
  it("exports version", () => {
    expect(NEXUS_VERSION).toBe("0.1.0");
  });

  it("exposes permission tiers", () => {
    expect(PermissionTier.Automatic).toBe(0);
    expect(PermissionTier.Notify).toBe(1);
    expect(PermissionTier.Ask).toBe(2);
    expect(PermissionTier.AskWithDetails).toBe(3);
  });

  it("validates tool input via zod", () => {
    const schema = z.object({ name: z.string().min(1) });
    const result = validateToolInput(schema, { name: "nexus" });
    expect(result).toEqual({ name: "nexus" });
  });

  it("throws on invalid tool input", () => {
    const schema = z.object({ name: z.string().min(1) });
    expect(() => validateToolInput(schema, { name: "" })).toThrow();
  });
});
