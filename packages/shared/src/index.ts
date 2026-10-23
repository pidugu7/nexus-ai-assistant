// @nexus/shared — central typed contracts for NEXUS AI
// This package is the single source of truth for IPC, events, and tool definitions.

export * from "./events.js";
export * from "./tools.js";
export * from "./csp.js";
export * from "./ipc.js";

export const NEXUS_VERSION = "0.1.0";
export const NEXUS_CHANNELS = {
  PING: "nexus:ping",
} as const;

export type NexusChannel = (typeof NEXUS_CHANNELS)[keyof typeof NEXUS_CHANNELS];
