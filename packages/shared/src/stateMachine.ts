export type AiCoreState = "idle" | "listening" | "thinking" | "executing" | "speaking" | "awaiting_approval" | "warning" | "error";

export type StateTransition = { from: AiCoreState; eventType: string; to: AiCoreState; guard?: (payload: unknown) => boolean };

const table: StateTransition[] = [
  { from: "idle", eventType: "voice.listening.started", to: "listening" },
  { from: "listening", eventType: "voice.listening.stopped", to: "idle" },
  { from: "listening", eventType: "voice.transcript", to: "thinking" },
  { from: "thinking", eventType: "llm.token", to: "thinking" },
  { from: "thinking", eventType: "llm.done", to: "executing" },
  { from: "thinking", eventType: "llm.error", to: "error" },
  { from: "thinking", eventType: "tool.started", to: "executing" },
  { from: "executing", eventType: "tool.finished", to: "thinking" },
  { from: "executing", eventType: "tool.failed", to: "error" },
  { from: "executing", eventType: "permission.requested", to: "awaiting_approval" },
  { from: "awaiting_approval", eventType: "permission.resolved", to: "executing", guard: (p) => (p as { granted?: boolean })?.granted === true },
  { from: "awaiting_approval", eventType: "permission.resolved", to: "thinking", guard: (p) => (p as { granted?: boolean })?.granted === false },
  { from: "executing", eventType: "task.step.started", to: "executing" },
  { from: "executing", eventType: "task.step.finished", to: "executing" },
  { from: "executing", eventType: "task.step.failed", to: "error" },
  { from: "executing", eventType: "llm.done", to: "speaking" },
  { from: "speaking", eventType: "voice.listening.stopped", to: "idle" },
  { from: "speaking", eventType: "llm.done", to: "idle" },
  { from: "thinking", eventType: "system.warning", to: "warning" },
  { from: "executing", eventType: "system.warning", to: "warning" },
  { from: "speaking", eventType: "system.warning", to: "warning" },
  { from: "warning", eventType: "voice.listening.started", to: "listening" },
];

export function nextState(from: AiCoreState, eventType: string, payload: unknown): AiCoreState | null {
  if (eventType === "system.kill" || eventType === "system.kill.legacy") return "idle";
  if (eventType === "error") return "error";
  for (const t of table) {
    if (t.from === from && t.eventType === eventType) {
      if (t.guard && !t.guard(payload)) continue;
      return t.to;
    }
  }
  return null;
}

export interface Machine {
  getState(): AiCoreState;
  canTransition(eventType: string, payload: unknown): boolean;
  transition(event: { type: string; payload: unknown }): { ok: true; from: AiCoreState; to: AiCoreState } | { ok: false; reason: string; from: AiCoreState };
  reset(): void;
}

export function createMachine(initial: AiCoreState = "idle"): Machine {
  let state: AiCoreState = initial;
  return {
    getState: () => state,
    canTransition: (type, payload) => nextState(state, type, payload) !== null,
    transition: (event) => {
      const nxt = nextState(state, event.type, event.payload);
      if (nxt === null) {
        return { ok: false as const, reason: `Illegal transition ${state} --${event.type}--> ?`, from: state };
      }
      const from = state;
      state = nxt;
      return { ok: true as const, from, to: nxt };
    },
    reset: () => {
      state = "idle";
    },
  };
}

export const ALL_STATES: AiCoreState[] = ["idle", "listening", "thinking", "executing", "speaking", "awaiting_approval", "warning", "error"];
