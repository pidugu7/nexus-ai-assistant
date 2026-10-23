import { describe, it, expect } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createFileLogStore } from "../src/main/fileLogStore.js";

describe("fileLogStore JSONL", () => {
  it("appends and loads last 200", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nexus-log-test-"));
    const store = createFileLogStore(dir);
    for (let i = 0; i < 5; i++) await store.append({ id: `${i}`, timestamp: new Date().toISOString(), level: "info", message: `msg ${i}` });
    const last = await store.loadLast(200);
    expect(last).toHaveLength(5);
    expect(last[0].message).toBe("msg 0");
  });

  it("rotation at 5MB keeps file small", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nexus-log-rot-"));
    const store = createFileLogStore(dir);
    const big = "x".repeat(1024 * 1024); // 1MB
    for (let i = 0; i < 6; i++) await store.append({ id: `${i}`, timestamp: new Date().toISOString(), level: "info", message: big });
    const { stat } = await import("fs/promises");
    const st = await stat(store.getPath());
    expect(st.size).toBeLessThan(5 * 1024 * 1024);
  });

  it("clearView does not delete file (tested via clear not called) — persistence check", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nexus-log-persist-"));
    const store = createFileLogStore(dir);
    await store.append({ id: "1", timestamp: new Date().toISOString(), level: "info", message: "persisted" });
    const before = await store.loadLast(10);
    expect(before.length).toBe(1);
    // simulate restart: new store instance same dir
    const store2 = createFileLogStore(dir);
    const after = await store2.loadLast(10);
    expect(after[0].message).toBe("persisted");
  });
});
