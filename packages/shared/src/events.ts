/**
 * Typed Event Bus for NEXUS AI
 *
 * All cross-process and intra-process events are defined here.
 * UI visuals are driven only by real events from this bus — never fake data.
 *
 * @example
 *  type MyEvent = NexusEventMap["engine:status"];
 *  bus.emit("engine:status", { state: "ready" });
 */

export type NexusEventMap = {
  "engine:status": { state: "idle" | "ready" | "busy" | "error"; message?: string };
  "engine:tool-call": { tool: string; input: unknown; permission: number };
  "engine:tool-result": { tool: string; ok: boolean; output?: unknown; error?: string };
  "ui:theme-changed": { theme: "light" | "dark" };
};

// Helper type for typed emitter
export type NexusEventName = keyof NexusEventMap;

export type NexusEventPayload<K extends NexusEventName> = NexusEventMap[K];

// Simple type-safe event bus interface (implementation lives in main/renderer)
export interface NexusEventBus {
  emit<K extends NexusEventName>(event: K, payload: NexusEventPayload<K>): void;
  on<K extends NexusEventName>(event: K, handler: (payload: NexusEventPayload<K>) => void): () => void;
  off<K extends NexusEventName>(event: K, handler: (payload: NexusEventPayload<K>) => void): void;
}
