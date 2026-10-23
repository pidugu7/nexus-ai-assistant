import { describe, it, expect } from "vitest";
import { isValidNavItem, NAV_ITEMS } from "../src/renderer/src/store/navStore.js";

describe("nav state", () => {
  it("lists 8 nav items", () => {
    expect(NAV_ITEMS).toHaveLength(8);
    expect(NAV_ITEMS).toContain("Home");
    expect(NAV_ITEMS).toContain("Settings");
  });
  it("validates nav items", () => {
    expect(isValidNavItem("Home")).toBe(true);
    expect(isValidNavItem("Projects")).toBe(true);
    expect(isValidNavItem("Fake")).toBe(false);
  });
});
