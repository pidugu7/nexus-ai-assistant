import { useSettingsStore } from "../store/settingsStore.js";
import { useQualityTier } from "../core/useQuality.js";
import type { QualityTier } from "../core/useQuality.js";

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

  const isFollowingSystem = storedValue === null;

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
    </div>
  );
}
