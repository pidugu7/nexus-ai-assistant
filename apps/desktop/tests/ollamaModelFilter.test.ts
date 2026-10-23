import { describe, it, expect } from "vitest";
import { isEmbeddingModel, splitModels, getDefaultChatModel, DEFAULT_CHAT_MODEL } from "../src/renderer/src/lib/ollama.js";
import type { OllamaModel } from "../src/renderer/src/lib/ollama.js";

describe("Ollama model filtering — chat vs embedding", () => {
  it("detects embedding models via name patterns", () => {
    const bge: OllamaModel = { name: "bge-m3:latest", details: { family: "bert", families: ["bert"] } };
    const embed: OllamaModel = { name: "nomic-embed-text:latest", details: { family: "bert" } };
    const qwen: OllamaModel = { name: "qwen3:8b", details: { family: "qwen3", families: ["qwen3"] } };
    expect(isEmbeddingModel(bge)).toBe(true);
    expect(isEmbeddingModel(embed)).toBe(true);
    expect(isEmbeddingModel(qwen)).toBe(false);
  });

  it("detects embedding via capabilities", () => {
    const capModel: OllamaModel = { name: "custom-embed", capabilities: ["embedding"] };
    expect(isEmbeddingModel(capModel)).toBe(true);
    const chatCap: OllamaModel = { name: "qwen3:8b", capabilities: ["completion"] };
    expect(isEmbeddingModel(chatCap)).toBe(false);
  });

  it("splits chat and embedding correctly", () => {
    const models: OllamaModel[] = [
      { name: "qwen3:8b", details: { family: "qwen3" } },
      { name: "bge-m3:latest", details: { family: "bert", families: ["bert"] } },
      { name: "llama3:8b", details: { family: "llama" } },
      { name: "all-minilm:latest", details: { family: "bert" } },
    ];
    const { chatModels, embeddingModels } = splitModels(models);
    expect(chatModels.map((m) => m.name)).toEqual(["qwen3:8b", "llama3:8b"]);
    expect(embeddingModels.map((m) => m.name)).toEqual(["bge-m3:latest", "all-minilm:latest"]);
  });

  it("chat picker excludes embedding models like bge-m3", () => {
    const models: OllamaModel[] = [
      { name: "qwen3:8b", details: { family: "qwen3" } },
      { name: "bge-m3:latest", details: { family: "bert" } },
    ];
    const { chatModels } = splitModels(models);
    expect(chatModels.some((m) => m.name === "bge-m3:latest")).toBe(false);
    expect(chatModels.some((m) => m.name === "qwen3:8b")).toBe(true);
  });

  it("default chat model is qwen3:8b and not llama3.1:8b", () => {
    expect(DEFAULT_CHAT_MODEL).toBe("qwen3:8b");
    expect(DEFAULT_CHAT_MODEL).not.toBe("llama3.1:8b");
    const chatModels: OllamaModel[] = [{ name: "qwen3:8b" }, { name: "bge-m3:latest" }, { name: "mistral:latest" }];
    expect(getDefaultChatModel(chatModels)).toBe("qwen3:8b");
    const withoutQwen: OllamaModel[] = [{ name: "mistral:latest" }, { name: "gemma:2b" }];
    expect(getDefaultChatModel(withoutQwen)).toBe("mistral:latest");
  });

  it("detects embedding via details family bert", () => {
    const bertModel: OllamaModel = { name: "some-model", details: { family: "bert" } };
    expect(isEmbeddingModel(bertModel)).toBe(true);
  });
});
