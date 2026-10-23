import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsView } from "../src/renderer/src/components/SettingsView.js";
import { useSettingsStore } from "../src/renderer/src/store/settingsStore.js";

describe("Settings — Ollama model picker and reasoning options", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
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
    // Mock fetch for Ollama tags
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes("/api/tags")) {
        return {
          ok: true,
          json: async () => ({
            models: [
              { name: "qwen3:8b", details: { family: "qwen3", families: ["qwen3"] } },
              { name: "bge-m3:latest", details: { family: "bert", families: ["bert"] } },
              { name: "mistral:latest", details: { family: "mistral" } },
            ],
          }),
        } as Response;
      }
      if (String(url).includes("/api/version")) {
        return { ok: true, json: async () => ({ version: "0.40.9" }) } as Response;
      }
      return { ok: false, status: 404, statusText: "Not Found", json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;
  });

  it("lists only chat-capable models in picker, excludes bge-m3", async () => {
    render(<SettingsView />);
    // Wait for models to load — check picker options
    const picker = await screen.findByTestId("model-picker");
    expect(picker).toBeInTheDocument();
    const options = Array.from(picker.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toContain("qwen3:8b");
    expect(options).toContain("mistral:latest");
    expect(options).not.toContain("bge-m3:latest");
    expect(options).not.toContain("bge-m3");
  });

  it("shows embedding models in separate read-only list", async () => {
    render(<SettingsView />);
    const embedList = await screen.findByTestId("embedding-models-list");
    expect(embedList).toBeInTheDocument();
    // embedding list should mention bge-m3
    // Need to wait for fetch
    await screen.findByTestId("model-picker");
    // Give time for state update
    await new Promise((r) => setTimeout(r, 50));
    const embedContainer = screen.getByTestId("embedding-models");
    expect(embedContainer.textContent).toContain("Embedding models");
    expect(embedContainer.textContent).toContain("used later for memory");
  });

  it("default chat model is qwen3:8b not llama3.1:8b", async () => {
    render(<SettingsView />);
    const picker = await screen.findByTestId("model-picker");
    expect(picker).toHaveValue("qwen3:8b");
    const options = Array.from(picker.querySelectorAll("option")).map((o) => o.value);
    expect(options).not.toContain("llama3.1:8b");
  });

  it("has Show model reasoning toggle default off", async () => {
    render(<SettingsView />);
    const toggle = screen.getByTestId("show-reasoning-toggle") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    expect(useSettingsStore.getState().showReasoning).toBe(true);
    // Toggle back
    fireEvent.click(toggle);
    expect(useSettingsStore.getState().showReasoning).toBe(false);
  });

  it("has Fast mode toggle and shows unsupported message handling", async () => {
    render(<SettingsView />);
    const fastToggle = screen.getByTestId("fast-mode-toggle") as HTMLInputElement;
    expect(fastToggle.checked).toBe(false);
    expect(screen.getByText(/Fast mode \(disable reasoning\)/)).toBeInTheDocument();
    fireEvent.click(fastToggle);
    expect(useSettingsStore.getState().fastMode).toBe(true);
    // Fast mode note appears
    expect(await screen.findByTestId("fast-mode-note")).toBeInTheDocument();
  });

  it("persists model selection", async () => {
    render(<SettingsView />);
    const picker = await screen.findByTestId("model-picker");
    fireEvent.change(picker, { target: { value: "mistral:latest" } });
    expect(useSettingsStore.getState().ollamaModel).toBe("mistral:latest");
    expect(localStorage.getItem("nexus:ollama-model")).toContain("mistral");
  });
});
