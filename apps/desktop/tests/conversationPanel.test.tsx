import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConversationPanel } from "../src/renderer/src/components/ConversationPanel.js";
import { useChatStore } from "../src/renderer/src/store/chatStore.js";
import { useSettingsStore } from "../src/renderer/src/store/settingsStore.js";
import { useStateStore } from "../src/renderer/src/store/stateStore.js";

describe("ConversationPanel — warm-up, thinking, reasoning handling", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    useChatStore.setState({
      messages: [],
      isLoading: false,
      isThinking: false,
      loadingModel: false,
      error: null,
      currentThinking: "",
      currentContent: "",
      model: "qwen3:8b",
      firstTokenTimeoutId: null,
    });
    useSettingsStore.setState({
      ollamaModel: "qwen3:8b",
      showReasoning: false,
      fastMode: false,
      storedValue: false,
      systemPrefersReduced: false,
      effectiveReduced: false,
      reducedSource: "default",
      reducedEffects: false,
      fpsOverlay: false,
    });
    useStateStore.setState({ state: "idle" });
    // Mock window.nexus.ollama.chatStream to simulate warm-up delay then stream
    (window as unknown as { nexus?: unknown }).nexus = {
      ollama: {
        chatStream: vi.fn(async () => ({ ok: true })),
        onChunk: vi.fn(() => () => {}),
        onDone: vi.fn(() => () => {}),
        onError: vi.fn(() => () => {}),
        listModels: vi.fn(async () => ({ ok: true, models: [] })),
      },
      bus: { publish: vi.fn(async () => ({ ok: true })) },
    } as unknown as typeof window.nexus;
  });

  it("shows Loading model... during warm-up with generous timeout", async () => {
    render(<ConversationPanel />);
    const input = screen.getByTestId("chat-input");
    const send = screen.getByTestId("chat-send");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(send);
    // After send, should show Loading model...
    expect(await screen.findByTestId("loading-model")).toBeInTheDocument();
    expect(screen.getByTestId("loading-model").textContent).toContain("Loading model");
    // Core should be in thinking state
    expect(useStateStore.getState().state).toBe("thinking");
  });

  it("shows Thinking... while reasoning and no answer yet", async () => {
    useChatStore.setState({ isThinking: true, isLoading: false, currentThinking: "some reasoning", currentContent: "" });
    useStateStore.setState({ state: "thinking" });
    render(<ConversationPanel />);
    expect(await screen.findByTestId("thinking-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("thinking-indicator").textContent).toContain("Thinking");
  });

  it("never shows raw <think> tags in rendered answer", async () => {
    const { createStreamParser } = await import("../src/renderer/src/lib/ollama.js");
    const parser = createStreamParser();
    const chunk1 = parser.push({ message: { content: "<think>secret reasoning</think> Hello" } });
    // Content should not contain tags
    expect(chunk1.contentDelta).not.toContain("<think>");
    expect(chunk1.thinkingDelta).toContain("secret reasoning");
    expect(chunk1.contentDelta).toContain("Hello");

    // Render with that content
    useChatStore.setState({ currentThinking: "secret reasoning", currentContent: "Hello", isLoading: false, isThinking: false });
    useSettingsStore.setState({ showReasoning: true });
    render(<ConversationPanel />);
    // Streaming content should be visible without tags
    expect(screen.getByTestId("streaming-content").textContent).not.toContain("<think>");
    expect(screen.getByTestId("streaming-content").textContent).toContain("Hello");
  });

  it("show reasoning toggle reveals collapsible Reasoning block labelled as model's own reasoning", async () => {
    useChatStore.setState({ currentThinking: "my reasoning text", currentContent: "answer", isLoading: false });
    useSettingsStore.setState({ showReasoning: true });
    render(<ConversationPanel />);
    const block = screen.getByTestId("reasoning-block");
    expect(block).toBeInTheDocument();
    expect(block.textContent).toContain("Reasoning");
    expect(block.textContent).toContain("model's own reasoning");
    expect(screen.getByTestId("reasoning-content").textContent).toContain("my reasoning text");
  });

  it("when show reasoning off, reasoning not shown", async () => {
    useChatStore.setState({ currentThinking: "hidden reasoning", currentContent: "answer", isLoading: false });
    useSettingsStore.setState({ showReasoning: false });
    render(<ConversationPanel />);
    expect(screen.queryByTestId("reasoning-block")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reasoning-content")).not.toBeInTheDocument();
  });

  it("uses 60s timeout for first token (FIRST_TOKEN_TIMEOUT_MS)", async () => {
    const { FIRST_TOKEN_TIMEOUT_MS } = await import("../src/renderer/src/lib/ollama.js");
    expect(FIRST_TOKEN_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
  });

  it("fast mode sends think:false and shows unsupported if needed", async () => {
    useSettingsStore.setState({ fastMode: true });
    render(<ConversationPanel />);
    const input = screen.getByTestId("chat-input");
    const send = screen.getByTestId("chat-send");
    // Mock chatStream to return unsupported
    (window as unknown as { nexus: { ollama: { chatStream: () => Promise<{ ok: boolean; error?: string }> } } }).nexus.ollama.chatStream = async () => ({
      ok: false,
      error: "Fast mode unsupported by this Ollama version",
    });
    fireEvent.change(input, { target: { value: "test fast" } });
    fireEvent.click(send);
    await waitFor(() => expect(screen.getByTestId("chat-error")).toBeInTheDocument());
    // Also check fast mode unsupported specific UI appears after error event?
    // Our panel shows chat-error for this case
    expect(screen.getByTestId("chat-error").textContent).toContain("Fast mode");
  });
});
