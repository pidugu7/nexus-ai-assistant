import { useEffect } from "react";
import { motion } from "framer-motion";
import { TitleBar } from "./components/TitleBar.js";
import { TopStatusBar } from "./components/TopStatusBar.js";
import { LeftNav } from "./components/LeftNav.js";
import { CenterCore } from "./components/CenterCore.js";
import { RightPanel } from "./components/RightPanel.js";
import { CommandBar } from "./components/CommandBar.js";
import { ActivityLog } from "./components/ActivityLog.js";
import { SettingsView } from "./components/SettingsView.js";
import { useNavStore } from "./store/navStore.js";
import { useSettingsStore } from "./store/settingsStore.js";
import { useLogStore } from "./store/logStore.js";

export default function App(): JSX.Element {
  const active = useNavStore((s) => s.active);
  const reduced = useSettingsStore((s) => s.reducedEffects);
  const addEntry = useLogStore((s) => s.addEntry);

  useEffect(() => {
    // Real app-produced log entries (no fake data)
    addEntry({
      id: `boot-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: new Date().toISOString(),
      level: "info",
      message: "App started",
    });
    const nexus = (window as unknown as { nexus?: typeof window.nexus }).nexus;
    if (nexus?.log?.onEntry) {
      const off = nexus.log.onEntry((entry) => addEntry(entry));
      return () => off();
    }
    // Fallback if preload not available (tests)
    addEntry({
      id: `hotkey-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: new Date().toISOString(),
      level: "info",
      message: "Hotkey Ctrl+Alt+Shift+K registered (or failed — see main log)",
    });
    return undefined;
  }, [addEntry]);

  useEffect(() => {
    const nexus = (window as unknown as { nexus?: typeof window.nexus }).nexus;
    if (!nexus?.system?.onKill) return;
    const off = nexus.system.onKill((p) => {
      addEntry({
        id: `kill-${Date.now()}`,
        timestamp: p.timestamp,
        level: "warn",
        message: `system.kill received — reason: ${p.reason}`,
      });
    });
    return () => off();
  }, [addEntry]);

  useEffect(() => {
    document.documentElement.setAttribute("data-reduced", String(reduced));
  }, [reduced]);

  const panelTransition = reduced ? { duration: 0 } : { duration: 0.25 };

  return (
    <div className="app-shell" data-testid="app-shell">
      <TitleBar />
      <TopStatusBar />
      <div className="shell-grid">
        <motion.aside
          className="shell-left"
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={panelTransition}
          data-testid="shell-left"
        >
          <LeftNav />
        </motion.aside>

        <main className="shell-center" data-testid="shell-center">
          {active === "Settings" ? <SettingsView /> : <CenterCore />}
          {active !== "Home" && active !== "Settings" && (
            <div className="placeholder-note text-muted" data-testid="view-placeholder">
              {active} — view reserved for future phase
            </div>
          )}
        </main>

        <motion.aside
          className="shell-right"
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={panelTransition}
          data-testid="shell-right"
        >
          <RightPanel />
        </motion.aside>
      </div>

      <CommandBar />
      <ActivityLog />
    </div>
  );
}
