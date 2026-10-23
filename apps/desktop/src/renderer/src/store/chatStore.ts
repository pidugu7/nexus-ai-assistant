import { create } from "zustand";
import { DEFAULT_CHAT_MODEL, FIRST_TOKEN_TIMEOUT_MS } from "../lib/ollama.js";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatTurn {
  id: string;
  role: ChatRole;
  content: string;
  thinking?: string | null;
  done: boolean;
}

interface ChatState {
  messages: ChatTurn[];
  isLoading: boolean; // warm-up: first token pending
  isThinking: boolean; // reasoning with no content yet
  loadingModel: boolean;
  error: string | null;
  currentThinking: string;
  currentContent: string;
  model: string;
  setModel: (m: string) => void;
  addUserMessage: (content: string) => void;
  startAssistant: () => void;
  appendThinking: (delta: string) => void;
  appendContent: (delta: string) => void;
  finishAssistant: () => void;
  setLoading: (v: boolean) => void;
  setThinking: (v: boolean) => void;
  setError: (e: string | null) => void;
  clear: () => void;
  firstTokenTimeoutId: ReturnType<typeof setTimeout> | null;
  setFirstTokenTimeout: (id: ReturnType<typeof setTimeout> | null) => void;
}

function loadModel(): string {
  try {
    const raw = localStorage.getItem("nexus:ollama-model");
    if (raw) return JSON.parse(raw) as string;
  } catch {
    // ignore
  }
  return DEFAULT_CHAT_MODEL;
}

const initialModel = loadModel();

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isThinking: false,
  loadingModel: false,
  error: null,
  currentThinking: "",
  currentContent: "",
  model: initialModel,
  firstTokenTimeoutId: null,
  setModel: (m) => {
    try {
      localStorage.setItem("nexus:ollama-model", JSON.stringify(m));
    } catch {
      // ignore
    }
    set({ model: m });
  },
  addUserMessage: (content) =>
    set((s) => ({
      messages: [...s.messages, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role: "user", content, done: true }],
    })),
  startAssistant: () =>
    set({
      isLoading: true,
      loadingModel: true,
      isThinking: false,
      currentThinking: "",
      currentContent: "",
      error: null,
    }),
  appendThinking: (delta) =>
    set((s) => ({
      currentThinking: s.currentThinking + delta,
      isThinking: true,
      isLoading: false,
      loadingModel: false,
    })),
  appendContent: (delta) =>
    set((s) => ({
      currentContent: s.currentContent + delta,
      isThinking: false,
      isLoading: false,
      loadingModel: false,
    })),
  finishAssistant: () => {
    const s = get();
    const thinking = s.currentThinking || null;
    const content = s.currentContent;
    // Do not create empty message if both empty and no error
    if (!content && !thinking) {
      set({ isLoading: false, isThinking: false, loadingModel: false });
      return;
    }
    set((prev) => ({
      messages: [...prev.messages, { id: `${Date.now()}-a`, role: "assistant", content, thinking, done: true }],
      currentThinking: "",
      currentContent: "",
      isLoading: false,
      isThinking: false,
      loadingModel: false,
    }));
    // Clear timeout if exists
    const t = get().firstTokenTimeoutId;
    if (t) {
      clearTimeout(t);
      set({ firstTokenTimeoutId: null });
    }
  },
  setLoading: (v) => set({ isLoading: v, loadingModel: v }),
  setThinking: (v) => set({ isThinking: v }),
  setError: (e) => set({ error: e, isLoading: false, isThinking: false, loadingModel: false }),
  clear: () => set({ messages: [], currentThinking: "", currentContent: "", error: null, isLoading: false, isThinking: false, loadingModel: false }),
  setFirstTokenTimeout: (id) => set({ firstTokenTimeoutId: id }),
}));

// Helper to start warm-up timer: call when request initiated
export function startFirstTokenTimer(onTimeout: () => void): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    onTimeout();
  }, FIRST_TOKEN_TIMEOUT_MS);
}
