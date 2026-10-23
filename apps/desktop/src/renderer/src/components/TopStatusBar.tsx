import { useClock } from "../hooks/useClock.js";
import { useStateStore } from "../store/stateStore.js";
import { useSettingsStore } from "../store/settingsStore.js";

export function TopStatusBar() {
  const { time, date } = useClock();
  const coreState = useStateStore((s) => s.state);
  const ollamaModel = useSettingsStore((s) => s.ollamaModel);
  // Show model name if configured, otherwise NOT CONNECTED (honest)
  // Default is qwen3:8b, don't assume llama3.1:8b
  const modelLabel = ollamaModel ? ollamaModel : "NOT CONNECTED";
  const isConnected = !!ollamaModel;
  return (
    <header className="statusbar" data-testid="statusbar">
      <div className="statusbar-left">
        <span className="status-label">NEXUS AI</span>
        <span className="status-pill status-offline" data-testid="status-state">
          {coreState.toUpperCase()}
        </span>
      </div>
      <div className="statusbar-center">
        <span className="status-model" data-testid="status-model">
          MODEL{" "}
          <span className={isConnected ? "" : "text-muted"} style={isConnected ? { color: "var(--cyan)" } : undefined} data-testid="model-name">
            {modelLabel}
          </span>
        </span>
      </div>
      <div className="statusbar-right font-mono" aria-live="polite" data-testid="clock">
        <span>{date}</span>
        <span className="clock-time">{time}</span>
      </div>
    </header>
  );
}
