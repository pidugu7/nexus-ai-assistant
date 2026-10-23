import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/chatStore.js";
import { useSettingsStore } from "../store/settingsStore.js";
import { useStateStore } from "../store/stateStore.js";
import { createStreamParser, buildChatRequest, FIRST_TOKEN_TIMEOUT_MS } from "../lib/ollama.js";
import { createEvent } from "@nexus/shared";

export function ConversationPanel() {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const isThinking = useChatStore((s) => s.isThinking);
  const currentThinking = useChatStore((s) => s.currentThinking);
  const currentContent = useChatStore((s) => s.currentContent);
  const error = useChatStore((s) => s.error);
  const model = useChatStore((s) => s.model);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const startAssistant = useChatStore((s) => s.startAssistant);
  const appendThinking = useChatStore((s) => s.appendThinking);
  const appendContent = useChatStore((s) => s.appendContent);
  const finishAssistant = useChatStore((s) => s.finishAssistant);
  const setError = useChatStore((s) => s.setError);
  const setLoading = useChatStore((s) => s.setLoading);
  const setThinking = useChatStore((s) => s.setThinking);

  const fastMode = useSettingsStore((s) => s.fastMode);
  const ollamaModel = useSettingsStore((s) => s.ollamaModel);
  const activeModel = ollamaModel || model;

  const setState = useStateStore((s) => s.setState);
  const [input, setInput] = useState("");
  const [fastUnsupportedMsg, setFastUnsupportedMsg] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const firstTokenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, currentThinking, currentContent, isLoading, isThinking]);

  // Handle Ollama stream events via preload
  useEffect(() => {
    const nexus = (window as unknown as { nexus?: { ollama?: { onChunk: (cb: (d: { thinking?: string; content?: string; done?: boolean }) => void) => () => void; onDone: (cb: () => void) => () => void; onError: (cb: (p: { message: string }) => void) => () => void } } }).nexus;
    if (!nexus?.ollama?.onChunk) return;
    const parser = createStreamParser();
    let hasReceivedContent = false;
    // track if we have seen any thinking for potential future use
    let hasReceivedThinking = false;
    void hasReceivedThinking;

    const unsubs: (() => void)[] = [];
    unsubs.push(
      nexus.ollama.onChunk((data) => {
        // Clear first token timeout on first chunk
        if (firstTokenTimerRef.current) {
          clearTimeout(firstTokenTimerRef.current);
          firstTokenTimerRef.current = null;
          setLoading(false);
        }
        const chunk = { message: { content: data.content || "", thinking: data.thinking || "" }, done: !!data.done } as never;
        const parsed = parser.push(chunk);
        if (parsed.thinkingDelta) {
          hasReceivedThinking = true;
          appendThinking(parsed.thinkingDelta);
          // Keep core in thinking while reasoning and no answer yet
          if (!hasReceivedContent) {
            setState("thinking");
          }
        }
        if (parsed.contentDelta) {
          hasReceivedContent = true;
          appendContent(parsed.contentDelta);
          // Once content arrives, move to speaking/thinking? Keep thinking if still reasoning? But spec says keep thinking while no answer
          // Once answer starts, we can set to speaking via event
          setState("speaking");
          // Also emit llm.token for state machine
          try {
            window.nexus?.bus?.publish(createEvent("llm.token", { token: parsed.contentDelta }, { source: "model" }));
          } catch {
            // ignore
          }
        }
        if (parsed.done || data.done) {
          const flushed = parser.flush();
          if (flushed?.thinkingDelta) appendThinking(flushed.thinkingDelta);
          if (flushed?.contentDelta) appendContent(flushed.contentDelta);
          finishAssistant();
          setState("idle");
          try {
            window.nexus?.bus?.publish(createEvent("llm.done", { text: useChatStore.getState().currentContent || "" }, { source: "model" }));
          } catch {
            // ignore
          }
        }
      })
    );
    unsubs.push(
      nexus.ollama.onDone(() => {
        if (firstTokenTimerRef.current) {
          clearTimeout(firstTokenTimerRef.current);
          firstTokenTimerRef.current = null;
        }
        const flushed = parser.flush();
        if (flushed?.thinkingDelta) appendThinking(flushed.thinkingDelta);
        if (flushed?.contentDelta) appendContent(flushed.contentDelta);
        finishAssistant();
        setState("idle");
        setLoading(false);
        setThinking(false);
      })
    );
    unsubs.push(
      nexus.ollama.onError((p) => {
        if (firstTokenTimerRef.current) {
          clearTimeout(firstTokenTimerRef.current);
          firstTokenTimerRef.current = null;
        }
        // Detect fast mode unsupported
        if (p.message && p.message.toLowerCase().includes("fast mode")) {
          setFastUnsupportedMsg(p.message);
          setTimeout(() => setFastUnsupportedMsg(null), 5000);
        }
        setError(p.message);
        setLoading(false);
        setThinking(false);
        setState("error");
      })
    );
    return () => unsubs.forEach((fn) => fn());
  }, [appendContent, appendThinking, finishAssistant, setError, setLoading, setState, setThinking]);

  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    addUserMessage(text);
    startAssistant();
    setState("thinking");
    // Warm-up: show Loading model... until first token, with 60s timeout
    // startAssistant already sets isLoading=true which renders Loading model...
    // Start generous timeout for first token
    if (firstTokenTimerRef.current) clearTimeout(firstTokenTimerRef.current);
    firstTokenTimerRef.current = setTimeout(() => {
      // Timeout after 60s
      const stillLoading = useChatStore.getState().isLoading;
      if (stillLoading) {
        setError(`Failed to get response: timeout after ${FIRST_TOKEN_TIMEOUT_MS / 1000}s (model may still be loading)`);
        setLoading(false);
        setThinking(false);
        setState("error");
      }
    }, FIRST_TOKEN_TIMEOUT_MS);

    // Emit llm.thinking for state tracking
    try {
      window.nexus?.bus?.publish(createEvent("llm.thinking", { prompt: text }, { source: "model" }));
    } catch {
      // ignore
    }

    // Build history for Ollama
    const history = [...useChatStore.getState().messages, { role: "user", content: text } as { role: "user"; content: string }].map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));
    // Add fastMode handling
    const nexus = (window as unknown as { nexus?: { ollama?: { chatStream: (p: unknown) => Promise<{ ok: boolean; error?: string }> } } }).nexus;
    if (nexus?.ollama?.chatStream) {
      const req = buildChatRequest(activeModel, history as never, fastMode);
      try {
        const res = await nexus.ollama.chatStream({ model: req.model, messages: req.messages as never, fastMode });
        if (!res.ok) {
          // Handle fast mode unsupported immediate error
          if (res.error && res.error.toLowerCase().includes("fast mode")) {
            setFastUnsupportedMsg(res.error);
            setError(res.error);
            setLoading(false);
            setState("warning");
            if (firstTokenTimerRef.current) {
              clearTimeout(firstTokenTimerRef.current);
              firstTokenTimerRef.current = null;
            }
            return;
          }
          // Other error — try direct fetch fallback
          throw new Error(res.error || "chatStream failed");
        }
      } catch (err) {
        // Fallback: try direct fetch to Ollama (for tests or when IPC not available)
        const msg = err instanceof Error ? err.message : String(err);
        // If not fast mode unsupported, attempt direct fetch
        if (!msg.toLowerCase().includes("fast mode")) {
          try {
            await directFetchChat(activeModel, history as never, fastMode, appendThinking, appendContent, finishAssistant, setError, setLoading, setState, setThinking);
            if (firstTokenTimerRef.current) {
              clearTimeout(firstTokenTimerRef.current);
              firstTokenTimerRef.current = null;
            }
            return;
          } catch (directErr) {
            const directMsg = directErr instanceof Error ? directErr.message : String(directErr);
            if (firstTokenTimerRef.current) {
              clearTimeout(firstTokenTimerRef.current);
              firstTokenTimerRef.current = null;
            }
            setError(directMsg);
            setLoading(false);
            setState("error");
          }
        }
      }
    } else {
      // No preload — try direct fetch (jsdom tests)
      try {
        await directFetchChat(activeModel, history as never, fastMode, appendThinking, appendContent, finishAssistant, setError, setLoading, setState, setThinking);
        if (firstTokenTimerRef.current) {
          clearTimeout(firstTokenTimerRef.current);
          firstTokenTimerRef.current = null;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (firstTokenTimerRef.current) {
          clearTimeout(firstTokenTimerRef.current);
          firstTokenTimerRef.current = null;
        }
        setError(msg);
        setLoading(false);
        setState("error");
      }
    }
  };

  return (
    <div className="conversation-panel" data-testid="conversation-panel" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 200 }}>
      <div
        ref={listRef}
        data-testid="conversation-list"
        style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8, minHeight: 120, maxHeight: 360 }}
      >
        {messages.length === 0 && !isLoading && !isThinking && !currentContent && !currentThinking && (
          <div data-testid="conversation-empty" style={{ color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>
            No messages yet — chat with {activeModel}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} data-testid={`message-${m.role}`} style={{ padding: "6px 8px", borderRadius: 6, background: m.role === "user" ? "var(--bg-elevated)" : "rgba(0,229,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2, textTransform: "uppercase" }}>{m.role}</div>
            {m.thinking && (
              <ThinkingBlock thinking={m.thinking} showByDefault={false} />
            )}
            <div data-testid="message-content" style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {m.content || (m.role === "assistant" && !m.content ? "(no content)" : "")}
            </div>
          </div>
        ))}
        {/* Warm-up loading state */}
        {isLoading && (
          <div data-testid="loading-model" style={{ padding: "6px 8px", fontSize: 12, color: "var(--cyan)", fontFamily: "var(--font-mono)" }}>
            Loading model...
          </div>
        )}
        {/* Thinking state — while model reasoning and no answer text yet */}
        {isThinking && !currentContent && (
          <div data-testid="thinking-indicator" style={{ padding: "6px 8px", fontSize: 12, color: "var(--cyan)", fontFamily: "var(--font-mono)" }}>
            Thinking...
          </div>
        )}
        {/* Streaming thinking + content */}
        {(currentThinking || currentContent) && (
          <div data-testid="streaming-answer" style={{ padding: "6px 8px", borderRadius: 6, background: "rgba(0,229,255,0.06)", border: "1px solid var(--cyan-border, rgba(0,229,255,0.2))" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>assistant</div>
            {currentThinking && <ThinkingBlock thinking={currentThinking} showByDefault={false} />}
            {currentContent && (
              <div data-testid="streaming-content" style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {currentContent}
              </div>
            )}
            {!currentContent && currentThinking && (
              <div data-testid="streaming-thinking-only" style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                Reasoning...
              </div>
            )}
          </div>
        )}
        {error && (
          <div data-testid="chat-error" style={{ padding: "6px 8px", borderRadius: 6, background: "rgba(255,59,74,0.1)", border: "1px solid var(--red)", color: "var(--red)", fontSize: 12 }}>
            {error}
          </div>
        )}
        {fastUnsupportedMsg && (
          <div data-testid="fast-mode-unsupported" style={{ padding: "6px 8px", borderRadius: 6, background: "rgba(255,176,46,0.1)", border: "1px solid var(--amber)", color: "var(--amber)", fontSize: 12 }}>
            Fast mode unsupported by this Ollama version: {fastUnsupportedMsg}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, padding: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <input
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={`Ask ${activeModel}...`}
          aria-label="Chat input"
          style={{ flex: 1, background: "var(--bg)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "var(--text-primary)", padding: "8px 10px", fontSize: 12, outline: "none" }}
        />
        <button
          data-testid="chat-send"
          onClick={onSend}
          disabled={!input.trim() || isLoading}
          style={{ padding: "6px 12px", borderRadius: 6, background: "var(--cyan)", color: "black", border: "none", fontSize: 12, cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.5 : 1 }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function ThinkingBlock({ thinking, showByDefault }: { thinking: string; showByDefault: boolean }) {
  const showReasoning = useSettingsStore((s) => s.showReasoning);
  const [open, setOpen] = useState(showByDefault);
  // If showReasoning is off, never show raw reasoning in main answer — only in collapsible when enabled
  if (!showReasoning) {
    // Still need to provide collapsible but hidden? Spec: "Add a Settings option Show model reasoning (default off) that shows it in a collapsible Reasoning block, labelled as the model's own reasoning."
    // So when off, we should not show thinking at all
    return null;
  }
  return (
    <details
      data-testid="reasoning-block"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      style={{ marginBottom: 6, background: "rgba(255,176,46,0.06)", border: "1px solid rgba(255,176,46,0.2)", borderRadius: 4, padding: "4px 6px" }}
    >
      <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--amber)", fontFamily: "var(--font-mono)" }}>
        Reasoning (model&apos;s own reasoning)
      </summary>
      <div data-testid="reasoning-content" style={{ marginTop: 4, fontSize: 11, whiteSpace: "pre-wrap", color: "var(--text-secondary)", fontStyle: "italic" }}>
        {thinking}
      </div>
    </details>
  );
}

async function directFetchChat(
  model: string,
  messages: { role: string; content: string }[],
  fastMode: boolean,
  appendThinking: (d: string) => void,
  appendContent: (d: string) => void,
  finishAssistant: () => void,
  setError: (m: string | null) => void,
  setLoading: (v: boolean) => void,
  setState: (s: "thinking" | "speaking" | "idle" | "error") => void,
  setThinking: (v: boolean) => void
) {
  const { createStreamParser: mkParser, buildChatRequest } = await import("../lib/ollama.js");
  const parser = mkParser();
  const req = buildChatRequest(model, messages as never, fastMode);
  const base = (typeof process !== "undefined" ? (process as unknown as { env?: Record<string, string> }).env?.OLLAMA_BASE_URL : "") || "http://localhost:11434";
  // Generous timeout for first token 60s
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FIRST_TOKEN_TIMEOUT_MS + 5_000);
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (fastMode && text.toLowerCase().includes("think")) {
        throw new Error(`Fast mode unsupported by this Ollama version: ${text}`);
      }
      throw new Error(`Ollama chat failed ${res.status}: ${text}`);
    }
    if (!res.body) throw new Error("No response body");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let firstToken = true;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const chunk = JSON.parse(line) as { message?: { content?: string; thinking?: string }; done?: boolean };
          if (firstToken) {
            firstToken = false;
            setLoading(false);
            clearTimeout(timeout);
          }
          const parsed = parser.push(chunk as never);
          if (parsed.thinkingDelta) appendThinking(parsed.thinkingDelta);
          if (parsed.contentDelta) appendContent(parsed.contentDelta);
          if (parsed.done || chunk.done) {
            const flushed = parser.flush();
            if (flushed?.thinkingDelta) appendThinking(flushed.thinkingDelta);
            if (flushed?.contentDelta) appendContent(flushed.contentDelta);
            finishAssistant();
            setState("idle");
            return;
          }
          if (parsed.contentDelta && !parsed.thinkingDelta) setState("speaking");
          else if (parsed.thinkingDelta && !parsed.contentDelta) setThinking(true);
        } catch {
          // ignore parse error
        }
      }
    }
    finishAssistant();
    setState("idle");
  } finally {
    clearTimeout(timeout);
  }
}
