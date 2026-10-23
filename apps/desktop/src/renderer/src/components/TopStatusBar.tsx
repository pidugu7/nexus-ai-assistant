import { useClock } from "../hooks/useClock.js";

export function TopStatusBar() {
  const { time, date } = useClock();
  return (
    <header className="statusbar" data-testid="statusbar">
      <div className="statusbar-left">
        <span className="status-label">NEXUS AI</span>
        <span className="status-pill status-offline">OFFLINE (UI ONLY)</span>
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
