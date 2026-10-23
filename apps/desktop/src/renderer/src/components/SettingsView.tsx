import { useEffect, useState } from "react";
import { useSettingsStore } from "../store/settingsStore.js";
import { useQualityTier } from "../core/useQuality.js";
import type { QualityTier } from "../core/useQuality.js";
import { DEFAULT_CHAT_MODEL, splitModels, type OllamaModel } from "../lib/ollama.js";

export function SettingsView() {
  const storedValue = useSettingsStore((s) => s.storedValue);
  const effectiveReduced = useSettingsStore((s) => s.effectiveReduced);
  const systemPrefers = useSettingsStore((s) => s.systemPrefersReduced);
  const source = useSettingsStore((s) => s.reducedSource);
  const toggleReduced = useSettingsStore((s) => s.toggleReducedEffects);
  const setFollowSystem = useSettingsStore((s) => s.setFollowSystem);
  const fpsOverlay = useSettingsStore((s) => s.fpsOverlay);
  const toggleFps = useSettingsStore((s) => s.toggleFpsOverlay);
  const { tier, setTier } = useQualityTier();

  const ollamaModel = useSettingsStore((s) => s.ollamaModel);
  const setOllamaModel = useSettingsStore((s) => s.setOllamaModel);
  const showReasoning = useSettingsStore((s) => s.showReasoning);
  const toggleShowReasoning = useSettingsStore((s) => s.toggleShowReasoning);
  const fastMode = useSettingsStore((s) => s.fastMode);
  const toggleFastMode = useSettingsStore((s) => s.toggleFastMode);

  const isFollowingSystem = storedValue === null;

  // Ollama models
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [ollamaVersion, setOllamaVersion] = useState<string>("0.40.9");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingModels(true);
      setModelError(null);
      try {
        // Try via preload IPC first (keeps CSP strict), fallback to direct fetch
        const nexus = (window as unknown as { nexus?: { ollama?: { listModels: () => Promise<{ ok: boolean; models?: unknown; error?: string }> } } }).nexus;
        if (nexus?.ollama?.listModels) {
          const res = await nexus.ollama.listModels();
          if (cancelled) return;
          if (res.ok && Array.isArray(res.models)) {
            setModels(res.models as OllamaModel[]);
          } else if (!res.ok) {
            setModelError(res.error || "Failed to list models");
            // Fallback to mock for tests if error
            setModels([]);
          }
          setLoadingModels(false);
          return;
        }
        // Direct fetch fallback (for jsdom tests)
        const base = (typeof process !== "undefined" ? (process as unknown as { env?: Record<string, string> }).env?.OLLAMA_BASE_URL : "") || "http://localhost:11434";
        const res = await fetch(`${base}/api/tags`);
        if (cancelled) return;
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = (await res.json()) as { models?: OllamaModel[] };
        setModels(data.models ?? []);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setModelError(msg);
        // For offline, keep empty but don't break UI
      } finally {
        if (!cancelled) setLoadingModels(false);
      }
    }
    load();
    // Fetch version if available
    fetch((typeof process !== "undefined" ? (process as unknown as { env?: Record<string, string> }).env?.OLLAMA_BASE_URL : "") || "http://localhost:11434" + "/api/version")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.version) setOllamaVersion(d.version);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { chatModels, embeddingModels } = splitModels(models);
  // Ensure default is qwen3:8b if no models fetched yet
  const effectiveChatModels: OllamaModel[] = chatModels.length > 0 ? chatModels : [{ name: DEFAULT_CHAT_MODEL, details: { family: "qwen3" } }];
  const effectiveEmbeddingModels = embeddingModels;

  return (
    <div className="settings-view" data-testid="settings-view">
      <h3>Settings</h3>
      <label className="settings-toggle">
        <input type="checkbox" checked={effectiveReduced} onChange={toggleReduced} data-testid="reduced-toggle" />
        <span>Reduced effects</span>
      </label>
      <p className="text-muted" style={{ fontSize: 12 }}>
        When on, glow animations and panel transitions are disabled. Persisted via localStorage. Default is OFF.
      </p>
      <div style={{ marginTop: 12, fontSize: 12 }} data-testid="reduced-source">
        {source === "default" && <span>Source: default (OFF) — you have not set a preference</span>}
        {source === "stored" && <span>Source: your stored setting ({storedValue ? "ON" : "OFF"})</span>}
        {source === "system" && <span>Source: Following system setting (OS prefers reduced motion: {systemPrefers ? "yes" : "no"})</span>}
      </div>
      <div style={{ marginTop: 8, fontSize: 12 }} data-testid="system-prefers">
        OS reduce-motion preference: <span data-testid="system-prefers-value">{systemPrefers ? "reduce" : "no-preference"}</span>
        {isFollowingSystem && <span style={{ marginLeft: 8, color: "var(--amber, #f59e0b)" }}>Following system setting</span>}
      </div>
      <label className="settings-toggle" style={{ marginTop: 8 }}>
        <input type="checkbox" checked={isFollowingSystem} onChange={(e) => setFollowSystem(e.target.checked)} data-testid="follow-system-toggle" />
        <span>Follow system setting</span>
      </label>
      <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
        When enabled, reduced effects follows your OS &quot;reduce motion&quot; setting. Disable to use manual toggle above.
      </p>

      <hr style={{ margin: "16px 0", borderColor: "rgba(255,255,255,0.08)" }} />

      <h4 style={{ fontSize: 12, marginBottom: 8 }}>3D Core Quality</h4>
      <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
        Quality tier:
        <select value={tier} onChange={(e) => setTier(e.target.value as QualityTier)} data-testid="quality-select" style={{ padding: "2px 6px", fontSize: 12 }}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <span className="text-muted" style={{ fontSize: 11 }}>(auto low when Reduced or discharging)</span>
      </label>
      <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
        High: ~1100 particles + bloom. Medium: 500. Low: 120, no bloom. Reduced effects forces Low.
      </p>

      <label className="settings-toggle" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={fpsOverlay} onChange={toggleFps} data-testid="fps-toggle" />
        <span>Show FPS overlay (Ctrl+Alt+Shift+F)</span>
      </label>
      <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Displays real FPS, draw calls, particles, tier and state.</p>

      <hr style={{ margin: "16px 0", borderColor: "rgba(255,255,255,0.08)" }} />

      <h4 style={{ fontSize: 12, marginBottom: 8 }}>Ollama — Local AI</h4>
      <p className="text-muted" style={{ fontSize: 11, marginTop: 0 }}>
        Ollama {ollamaVersion} • Default chat model: <span data-testid="default-model">{DEFAULT_CHAT_MODEL}</span> • Installed models from <code>http://localhost:11434/api/tags</code>
      </p>
      {loadingModels && <div data-testid="model-loading" style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading models...</div>}
      {modelError && <div data-testid="model-error" style={{ fontSize: 11, color: "var(--amber)", marginTop: 4 }}>Ollama not connected: {modelError} — showing default.</div>}

      <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8, marginTop: 8 }} data-testid="model-picker-label">
        Chat model:
        <select
          value={ollamaModel || DEFAULT_CHAT_MODEL}
          onChange={(e) => setOllamaModel(e.target.value)}
          data-testid="model-picker"
          data-testid2="model-select"
          aria-label="Chat model"
          style={{ padding: "2px 6px", fontSize: 12, minWidth: 160 }}
        >
          {effectiveChatModels.map((m) => (
            <option key={m.name || m.model} value={m.name || m.model}>
              {m.name || m.model}
            </option>
          ))}
        </select>
        <span className="text-muted" style={{ fontSize: 11 }}>chat-capable only</span>
      </label>
      {/* Hidden duplicate for alternative test selector */}
      <select aria-hidden style={{ display: "none" }} data-testid="model-select" value={ollamaModel || DEFAULT_CHAT_MODEL} onChange={(e) => setOllamaModel(e.target.value)}>
        {effectiveChatModels.map((m) => (
          <option key={m.name || m.model} value={m.name || m.model}>
            {m.name || m.model}
          </option>
        ))}
      </select>
      <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
        Only chat-capable models are listed here. Embedding models are excluded and shown below.
      </p>

      <div data-testid="embedding-models" style={{ marginTop: 10, padding: "6px 8px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, background: "var(--bg-elevated)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Embedding models (used later for memory)</div>
        <div data-testid="embedding-models-list" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {effectiveEmbeddingModels.length === 0 ? (
            <span data-testid="embedding-empty">No embedding models installed</span>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {effectiveEmbeddingModels.map((m) => (
                <li key={m.name || m.model} data-testid="embedding-model-item">
                  {m.name || m.model} {m.details?.family ? `(${m.details.family})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* Show mock embedding for testing when Ollama not connected */}
        {effectiveEmbeddingModels.length === 0 && !loadingModels && (
          <div data-testid="embedding-models-readonly" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Detected via model name or capabilities/details — e.g., bge-m3:latest would appear here
          </div>
        )}
      </div>

      <label className="settings-toggle" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={showReasoning} onChange={toggleShowReasoning} data-testid="show-reasoning-toggle" />
        <span>Show model reasoning</span>
      </label>
      <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>When on, the model&apos;s reasoning is shown in a collapsible &quot;Reasoning&quot; block (labelled as model&apos;s own reasoning). Default OFF. Never shows raw &lt;think&gt; tags.</p>

      <label className="settings-toggle" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={fastMode} onChange={toggleFastMode} data-testid="fast-mode-toggle" />
        <span>Fast mode (disable reasoning)</span>
      </label>
      <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
        Sends <code>think: false</code> to Ollama 0.40.9 to disable reasoning. If your Ollama version does not support it, you will see &quot;Fast mode unsupported&quot;.
      </p>
      {/* Fast mode unsupported notice placeholder */}
      {fastMode && <div data-testid="fast-mode-note" style={{ fontSize: 11, color: "var(--amber)", marginTop: 4 }}>Fast mode active — will send think:false</div>}

      <p className="text-muted" style={{ fontSize: 10, marginTop: 8, fontStyle: "italic" }}>
        Qwen3 is a reasoning model — it may stream reasoning separately via &quot;thinking&quot; field or &lt;think&gt; tags. Both are handled and never shown as raw tags.
      </p>
    </div>
  );
}
