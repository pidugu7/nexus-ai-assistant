import { useClock } from "../hooks/useClock.js";
import { useStateStore } from "../store/stateStore.js";

export function TopStatusBar() {
  const { time, date } = useClock();
  const coreState = useStateStore((s) => s.state);
  // TRACE HOP 9
  try { console.log(`[HOP 9] renderer: the status bar component renders with the state it received ${coreState}`); } catch (_e) { void _e; }
  return (
    <header className="statusbar" data-testid="statusbar">
      <div className="statusbar-left">
        <span className="status-label">NEXUS AI</span>
        <span className="status-pill status-offline" data-testid="status-state">
          {coreState.toUpperCase()}
        </span>
      </div>
      <div className="statusbar-center">
        <span className="status-model">
          MODEL <span className="text-muted">NOT CONNECTED</span>
        </span>
      </div>
      <div className="statusbar-right font-mono" aria-live="polite" data-testid="clock">
        <span>{date}</span>
        <span className="clock-time">{time}</span>
      </div>
    </header>
  );
}
