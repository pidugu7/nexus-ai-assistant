import { describe, it, expect } from "vitest";
import { createStreamParser, stripThinkTags, createStreamParser as mkParser } from "../src/renderer/src/lib/ollama.js";

describe("Ollama reasoning parser — Qwen3", () => {
  it("handles newer Ollama thinking field separately (case a)", () => {
    const parser = createStreamParser();
    // Simulate streamed chunks with thinking field
    const c1 = parser.push({ message: { content: "", thinking: "We need to think about" } });
    expect(c1.thinkingDelta).toBe("We need to think about");
    expect(c1.contentDelta).toBe("");
    const c2 = parser.push({ message: { content: " step by step", thinking: " reasoning continues" } });
    expect(c2.thinkingDelta).toBe(" reasoning continues");
    expect(c2.contentDelta).toBe(" step by step");
    const c3 = parser.push({ message: { content: " final answer", thinking: "" } });
    expect(c3.contentDelta).toBe(" final answer");
    // Never shows raw thinking in content
    expect(c3.contentDelta).not.toContain("<think>");
  });

  it("handles <think> tags in content (case b) and never shows raw tags", () => {
    const parser = createStreamParser();
    const c1 = parser.push({ message: { content: "<think>internal reasoning" } });
    expect(c1.thinkingDelta).toBe("internal reasoning");
    expect(c1.contentDelta).toBe("");
    expect(c1.contentDelta).not.toContain("<think>");

    const c2 = parser.push({ message: { content: " more reasoning</think> Hello world" } });
    expect(c2.thinkingDelta).toBe(" more reasoning");
    expect(c2.contentDelta).toBe(" Hello world");
    expect(c2.contentDelta).not.toContain("<think>");
    expect(c2.contentDelta).not.toContain("</think>");
  });

  it("handles <think> tags split across chunks", () => {
    const parser = createStreamParser();
    // Simulate split tag: first chunk ends with partial tag
    const c1 = parser.push({ message: { content: "Hello <thi" } });
    // Should buffer partial tag, not yet emit as content
    expect(c1.contentDelta).toBe("Hello ");
    expect(c1.thinkingDelta).toBe("");
    const c2 = parser.push({ message: { content: "nk>thinking content</think> world" } });
    expect(c2.thinkingDelta).toBe("thinking content");
    expect(c2.contentDelta).toBe(" world");
    expect(c2.contentDelta).not.toContain("<think>");
  });

  it("handles mixed thinking field + think tags (should strip tags even when thinking field present)", () => {
    const parser = createStreamParser();
    const c = parser.push({ message: { content: "<think>tag reasoning</think>Answer", thinking: "field reasoning" } });
    expect(c.thinkingDelta).toBe("field reasoning" + "tag reasoning");
    expect(c.contentDelta).toBe("Answer");
    expect(c.contentDelta).not.toContain("<think>");
  });

  it("stripThinkTags utility works", () => {
    const { clean, thinking } = stripThinkTags("<think>reason</think> hello");
    expect(clean).toBe(" hello");
    expect(thinking).toBe("reason");
    const noTag = stripThinkTags("hello world");
    expect(noTag.clean).toBe("hello world");
    expect(noTag.thinking).toBe(null);
  });

  it("never shows raw <think> tags in contentDelta across full stream", () => {
    const parser = mkParser();
    const mockStream = [
      { message: { content: "<think>" } },
      { message: { content: "We are reasoning" } },
      { message: { content: "</think>" } },
      { message: { content: " Final answer here" } },
    ];
    let fullContent = "";
    let fullThinking = "";
    for (const chunk of mockStream) {
      const p = parser.push(chunk);
      fullContent += p.contentDelta;
      fullThinking += p.thinkingDelta;
    }
    expect(fullContent).not.toContain("<think>");
    expect(fullContent).not.toContain("</think>");
    expect(fullContent).toContain("Final answer");
    expect(fullThinking).toContain("We are reasoning");
  });

  it("thinking field variant does not leak into content", () => {
    const parser = createStreamParser();
    const chunks = [
      { message: { thinking: "Chain of thought", content: "" } },
      { message: { thinking: " continues", content: "Hello" } },
      { message: { thinking: "", content: " world" } },
    ];
    let content = "";
    let thinking = "";
    for (const ch of chunks) {
      const p = parser.push(ch);
      content += p.contentDelta;
      thinking += p.thinkingDelta;
    }
    expect(content).toBe("Hello world");
    expect(thinking).toBe("Chain of thought continues");
    expect(content).not.toContain("Chain of thought");
  });

  it("handles fast mode request building", async () => {
    const { buildChatRequest } = await import("../src/renderer/src/lib/ollama.js");
    const reqFast = buildChatRequest("qwen3:8b", [{ role: "user", content: "hi" }], true);
    expect(reqFast.think).toBe(false);
    expect(reqFast.model).toBe("qwen3:8b");
    const reqNormal = buildChatRequest("qwen3:8b", [{ role: "user", content: "hi" }], false);
    expect(reqNormal.think).toBeUndefined();
  });
});
