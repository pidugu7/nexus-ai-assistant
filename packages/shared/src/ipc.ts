import { z } from "zod";

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
  // Phase 2
  BUS_PUBLISH: "nexus:bus:publish",
  BUS_SUBSCRIBE: "nexus:bus:event",
  STATE_GET: "nexus:state:get",
  STATE_CHANGED: "nexus:state:changed",
  LOG_GET: "nexus:log:get",
  LOG_CLEAR_VIEW: "nexus:log:clear-view",
  DEV_TOGGLE: "nexus:dev:toggle",
  FPS_TOGGLE: "nexus:fps:toggle",
  TOAST: "nexus:toast",
  // Phase 4 — Ollama
  OLLAMA_LIST_MODELS: "nexus:ollama:list-models",
  OLLAMA_CHAT_STREAM: "nexus:ollama:chat-stream",
  OLLAMA_CHAT_CHUNK: "nexus:ollama:chat-chunk",
  OLLAMA_CHAT_DONE: "nexus:ollama:chat-done",
  OLLAMA_CHAT_ERROR: "nexus:ollama:chat-error",
} as const;

export type NexusIpcChannel = (typeof NEXUS_IPC)[keyof typeof NEXUS_IPC];

export const windowActionSchema = z.union([z.undefined(), z.object({}).strict()]);
export const emptySchema = z.union([z.undefined(), z.object({}).strict()]);

export const logEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  level: z.enum(["info", "warn", "error"]),
  message: z.string(),
  source: z.string().optional(),
  type: z.string().optional(),
});

export type LogEntry = z.infer<typeof logEntrySchema>;

export const killEventSchema = z.object({ reason: z.string(), timestamp: z.string() });
export type KillEvent = z.infer<typeof killEventSchema>;
