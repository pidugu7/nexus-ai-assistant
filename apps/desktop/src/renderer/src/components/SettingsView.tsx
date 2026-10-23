import { useSettingsStore } from "../store/settingsStore.js";

export function SettingsView() {
  const { reducedEffects, toggleReducedEffects } = useSettingsStore();

  return (
    <div className="settings-view" data-testid="settings-view">
      <h3>Settings</h3>
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={reducedEffects}
          onChange={toggleReducedEffects}
          data-testid="reduced-toggle"
        />
        <span>Reduced effects</span>
      </label>
      <p className="text-muted" style={{ fontSize: 12 }}>
        When on, glow animations and panel transitions are disabled. Persisted via localStorage.
      </p>
    </div>
  );
}
