import { z } from "zod";

/**
 * Typed IPC channels for NEXUS AI Phase 1.
 * All channels are defined here and only exposed via preload contextBridge.
 * Main process validates every input with Zod before acting.
 */

export const NEXUS_IPC = {
  WINDOW_MINIMIZE: "nexus:window:minimize",
  WINDOW_MAXIMIZE: "nexus:window:maximize",
  WINDOW_CLOSE: "nexus:window:close",
  WINDOW_TOGGLE_FULLSCREEN: "nexus:window:toggle-fullscreen",
  WINDOW_IS_MAXIMIZED: "nexus:window:is-maximized",
  WINDOW_IS_FULLSCREEN: "nexus:window:is-fullscreen",
  WINDOW_ON_MAXIMIZED_CHANGED: "nexus:window:maximized-changed",
  WINDOW_ON_FULLSCREEN_CHANGED: "nexus:window:fullscreen-changed",
  SYSTEM_KILL: "nexus:system:kill",
  LOG_ENTRY: "nexus:log:entry",
} as const;

export type NexusIpcChannel = (typeof NEXUS_IPC)[keyof typeof NEXUS_IPC];

// No payload for window controls — validation ensures empty or undefined
export const windowActionSchema = z.union([z.undefined(), z.object({}).strict()]);

// Log entry payload from main → renderer
export const logEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  level: z.enum(["info", "warn", "error"]),
  message: z.string(),
});

export type LogEntry = z.infer<typeof logEntrySchema>;

// Kill event payload
export const killEventSchema = z.object({
  reason: z.string(),
  timestamp: z.string(),
});
export type KillEvent = z.infer<typeof killEventSchema>;
