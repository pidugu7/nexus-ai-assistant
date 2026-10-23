import { z } from "zod";

export const EventSourceSchema = z.enum(["user", "model", "system", "simulated"]);
export type EventSource = z.infer<typeof EventSourceSchema>;

export const BaseMetaSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1), // ISO string
  source: EventSourceSchema,
});

export const VoiceListeningStartedPayload = z.object({ reason: z.string().optional() });
export const VoiceListeningStoppedPayload = z.object({ durationMs: z.number().optional() });
export const VoiceTranscriptPayload = z.object({ text: z.string(), isFinal: z.boolean() });

export const LlmThinkingPayload = z.object({ prompt: z.string().optional() });
export const LlmTokenPayload = z.object({ token: z.string() });
export const LlmDonePayload = z.object({ text: z.string() });
export const LlmErrorPayload = z.object({ message: z.string() });

export const ToolStartedPayload = z.object({ tool: z.string().min(1), input: z.unknown() });
export const ToolFinishedPayload = z.object({ tool: z.string().min(1), output: z.unknown() });
export const ToolFailedPayload = z.object({ tool: z.string().min(1), error: z.string() });

export const PermissionRequestedPayload = z.object({ tool: z.string().min(1), permission: z.number(), input: z.unknown() });
export const PermissionResolvedPayload = z.object({ tool: z.string().min(1), granted: z.boolean(), actor: z.enum(["user", "system"]) });

export const TaskStepStartedPayload = z.object({ step: z.string().min(1), title: z.string().optional() });
export const TaskStepFinishedPayload = z.object({ step: z.string().min(1), result: z.unknown().optional() });
export const TaskStepFailedPayload = z.object({ step: z.string().min(1), error: z.string() });

export const SystemKillPayload = z.object({ reason: z.string() });
export const SystemWarningPayload = z.object({ message: z.string(), code: z.string().optional() });
export const ErrorPayload = z.object({ message: z.string(), stack: z.string().optional(), code: z.string().optional() });

export const NexusEventTypeSchema = z.enum([
  "voice.listening.started",
  "voice.listening.stopped",
  "voice.transcript",
  "llm.thinking",
  "llm.token",
  "llm.done",
  "llm.error",
  "tool.started",
  "tool.finished",
  "tool.failed",
  "permission.requested",
  "permission.resolved",
  "task.step.started",
  "task.step.finished",
  "task.step.failed",
  "system.kill",
  "system.warning",
  "error",
  // legacy compat
  "engine:status",
  "engine:tool-call",
  "engine:tool-result",
  "ui:theme-changed",
  "system.kill.legacy",
  "window:maximized-changed",
  "window:fullscreen-changed",
  "log:entry",
]);

export type NexusEventType = z.infer<typeof NexusEventTypeSchema>;

const payloadByType: Record<string, z.ZodTypeAny> = {
  "voice.listening.started": VoiceListeningStartedPayload,
  "voice.listening.stopped": VoiceListeningStoppedPayload,
  "voice.transcript": VoiceTranscriptPayload,
  "llm.thinking": LlmThinkingPayload,
  "llm.token": LlmTokenPayload,
  "llm.done": LlmDonePayload,
  "llm.error": LlmErrorPayload,
  "tool.started": ToolStartedPayload,
  "tool.finished": ToolFinishedPayload,
  "tool.failed": ToolFailedPayload,
  "permission.requested": PermissionRequestedPayload,
  "permission.resolved": PermissionResolvedPayload,
  "task.step.started": TaskStepStartedPayload,
  "task.step.finished": TaskStepFinishedPayload,
  "task.step.failed": TaskStepFailedPayload,
  "system.kill": SystemKillPayload,
  "system.warning": SystemWarningPayload,
  error: ErrorPayload,
};

export const NexusEventSchema = z
  .object({
    id: z.string().min(1),
    timestamp: z.string().min(1),
    source: EventSourceSchema,
    type: NexusEventTypeSchema,
    payload: z.unknown(),
    level: z.enum(["info", "warn", "error"]).optional(),
    message: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const schema = payloadByType[val.type];
    if (schema) {
      const res = schema.safeParse(val.payload);
      if (!res.success) {
        for (const issue of res.error.issues) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `payload: ${issue.message}`, path: ["payload", ...issue.path] });
        }
      }
    }
  });

export type NexusEvent = z.infer<typeof NexusEventSchema> & { level?: "info" | "warn" | "error"; message?: string };

export function createEvent<T extends NexusEventType>(type: T, payload: unknown, opts: { source: EventSource; id?: string; timestamp?: string }): NexusEvent {
  const base: NexusEvent = {
    id: opts.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: opts.timestamp ?? new Date().toISOString(),
    source: opts.source,
    type,
    payload: payload ?? {},
  };
  // attach derived level/message for backwards log display
  const derived = deriveLevelMessage(type, payload);
  if (derived.level) base.level = derived.level;
  if (derived.message) base.message = derived.message;
  return base;
}

function deriveLevelMessage(type: string, payload: unknown): { level?: "info" | "warn" | "error"; message?: string } {
  if (type.startsWith("voice.")) return { level: "info", message: type };
  if (type === "llm.thinking") return { level: "info", message: "LLM thinking" };
  if (type === "llm.token") return { level: "info", message: `token: ${(payload as { token?: string })?.token ?? ""}`.slice(0, 60) };
  if (type === "llm.done") return { level: "info", message: "LLM done" };
  if (type === "llm.error") return { level: "error", message: (payload as { message?: string })?.message ?? "LLM error" };
  if (type === "tool.started") return { level: "info", message: `tool started: ${(payload as { tool?: string })?.tool}` };
  if (type === "tool.finished") return { level: "info", message: `tool finished: ${(payload as { tool?: string })?.tool}` };
  if (type === "tool.failed") return { level: "error", message: `tool failed: ${(payload as { tool?: string })?.tool}` };
  if (type.startsWith("permission.")) return { level: "warn", message: type };
  if (type.startsWith("task.step.")) return { level: type.endsWith(".failed") ? "error" : "info", message: type };
  if (type === "system.kill") return { level: "warn", message: `system.kill: ${(payload as { reason?: string })?.reason ?? ""}` };
  if (type === "system.warning") return { level: "warn", message: (payload as { message?: string })?.message ?? "warning" };
  if (type === "error") return { level: "error", message: (payload as { message?: string })?.message ?? "error" };
  return { level: "info", message: type };
}

// Renderer allowlist — only these types may be published from renderer in dev as simulated
export const RENDERER_PUBLISH_ALLOWLIST: NexusEventType[] = [
  "voice.listening.started",
  "voice.listening.stopped",
  "voice.transcript",
  "llm.thinking",
  "llm.token",
  "llm.done",
  "llm.error",
  "tool.started",
  "tool.finished",
  "tool.failed",
  "permission.requested",
  "permission.resolved",
  "task.step.started",
  "task.step.finished",
  "task.step.failed",
  "system.kill",
  "system.warning",
  "error",
];

// Legacy map for compatibility with previous App logic (deprecated)
export type NexusEventMap = {
  "engine:status": { state: "idle" | "ready" | "busy" | "error"; message?: string };
  "engine:tool-call": { tool: string; input: unknown; permission: number };
  "engine:tool-result": { tool: string; ok: boolean; output?: unknown; error?: string };
  "ui:theme-changed": { theme: "light" | "dark" };
  "system.kill": { reason: string; timestamp: string };
  "window:maximized-changed": { isMaximized: boolean };
  "window:fullscreen-changed": { isFullscreen: boolean };
  "log:entry": { id: string; timestamp: string; level: "info" | "warn" | "error"; message: string };
  "state:changed": { from: string; to: string; eventId: string };
};
export type NexusEventName = keyof NexusEventMap;
export type NexusEventPayload<K extends NexusEventName> = NexusEventMap[K];
export interface NexusEventBus {
  emit<K extends NexusEventName>(event: K, payload: NexusEventPayload<K>): void;
  on<K extends NexusEventName>(event: K, handler: (payload: NexusEventPayload<K>) => void): () => void;
  off<K extends NexusEventName>(event: K, handler: (payload: NexusEventPayload<K>) => void): void;
}
