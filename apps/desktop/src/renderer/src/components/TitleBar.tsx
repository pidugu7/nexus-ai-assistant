import { useEffect, useState } from "react";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const nexus = (window as unknown as { nexus?: typeof window.nexus }).nexus;
    if (!nexus) return;
    nexus.window.isMaximized().then((r) => setIsMaximized(r.isMaximized));
    const offMax = nexus.window.onMaximizedChanged((v) => setIsMaximized(v.isMaximized));
    const offFull = nexus.window.onFullscreenChanged(() => {
      // no visual change, but keep in sync if needed
    });
    return () => {
      offMax();
      offFull();
    };
  }, []);

  const minimize = () => window.nexus?.window.minimize();
  const maximize = () => window.nexus?.window.maximize();
  const close = () => window.nexus?.window.close();

  return (
    <div
      className="titlebar"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      data-testid="titlebar"
    >
      <div className="titlebar-left">
        <span className="titlebar-app">NEXUS AI</span>
        <span className="titlebar-sub">SHELL v0.1</span>
      </div>
      <div className="titlebar-right" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button aria-label="Minimize" className="titlebar-btn" onClick={minimize} type="button">
          —
        </button>
        <button aria-label={isMaximized ? "Restore" : "Maximize"} className="titlebar-btn" onClick={maximize} type="button">
          {isMaximized ? "❐" : "□"}
        </button>
        <button aria-label="Close" className="titlebar-btn titlebar-btn-close" onClick={close} type="button">
          ✕
        </button>
      </div>
    </div>
  );
}
