import { describe, it, expect } from "vitest";
import { formatTime, formatDate, formatClock } from "../src/renderer/src/lib/formatClock.js";

describe("formatClock", () => {
  it("formats time HH:MM:SS", () => {
    const d = new Date(2026, 0, 2, 3, 4, 5); // Jan 2 2026 03:04:05 local
    expect(formatTime(d)).toBe("03:04:05");
  });
  it("pads single digits", () => {
    const d = new Date(2026, 0, 2, 0, 0, 9);
    expect(formatTime(d)).toBe("00:00:09");
  });
  it("formats date YYYY-MM-DD", () => {
    const d = new Date(2026, 11, 5);
    expect(formatDate(d)).toBe("2026-12-05");
  });
  it("formatClock returns both", () => {
    const d = new Date(2026, 5, 15, 12, 30, 45);
    const c = formatClock(d);
    expect(c.time).toBe("12:30:45");
    expect(c.date).toBe("2026-06-15");
  });
});
