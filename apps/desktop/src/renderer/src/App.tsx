import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TitleBar } from "./components/TitleBar.js";
import { TopStatusBar } from "./components/TopStatusBar.js";
import { LeftNav } from "./components/LeftNav.js";
import { CenterCore } from "./components/CenterCore.js";
import { RightPanel } from "./components/RightPanel.js";
import { CommandBar } from "./components/CommandBar.js";
import { ActivityLog } from "./components/ActivityLog.js";
import { SettingsView } from "./components/SettingsView.js";
import { DevPanel } from "./components/DevPanel.js";
import { useNavStore } from "./store/navStore.js";
import { useSettingsStore } from "./store/settingsStore.js";
import { useLogStore } from "./store/logStore.js";
import { useStateStore } from "./store/stateStore.js";

export default function App(): JSX.Element {
  const active = useNavStore((s) => s.active);
  const reduced = useSettingsStore((s) => s.reducedEffects);
  const addEntry = useLogStore((s) => s.addEntry);
  const setEntries = useLogStore((s) => s.setEntries);
  const setState = useStateStore((s) => s.setState);
  const [devOpen, setDevOpen] = useState(false);
  const isDev = !(window as unknown as { __NEXUS_IS_PACKAGED__?: boolean }).__NEXUS_IS_PACKAGED__;
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const nexus = (window as unknown as { nexus?: typeof window.nexus }).nexus;
    if (nexus?.log?.get) {
      nexus.log.get(200).then((entries) => {
        if (entries.length > 0) setEntries(entries);
      });
    }
    if (nexus?.state?.get) {
      nexus.state.get().then((s) => setState(s.state as never));
    }
    const unsubs: (() => void)[] = [];
    if (nexus?.bus?.onEvent) {
      unsubs.push(
        nexus.bus.onEvent((ev) => {
          addEntry({
            id: ev.id,
            timestamp: ev.timestamp,
            level: (ev.level as never) ?? "info",
            message: ev.message ?? ev.type,
            source: ev.source,
            type: ev.type,
          });
        })
      );
    } else if (nexus?.log?.onEntry) {
      unsubs.push(nexus.log.onEntry((entry) => addEntry(entry as never)));
    }
    if (nexus?.state?.onChanged) {
      unsubs.push(
        nexus.state.onChanged((p) => {
          setState(p.state as never);
          addEntry({
            id: `state-${Date.now()}`,
            timestamp: new Date().toISOString(),
            level: "info",
            message: `state ${p.from} → ${p.to}`,
            source: "system",
            type: "state.changed",
          });
        })
      );
    }
    if (nexus?.system?.onKill) {
      unsubs.push(
        nexus.system.onKill((p) => {
          addEntry({
            id: `kill-${Date.now()}`,
            timestamp: p.timestamp,
            level: "warn",
            message: `system.kill received — reason: ${p.reason}`,
            source: "system",
          });
        })
      );
    }
    return () => unsubs.forEach((fn) => fn());
  }, [addEntry, setEntries, setState]);

  useEffect(() => {
    document.documentElement.setAttribute("data-reduced", String(reduced));
  }, [reduced]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === "d") {
        if (!isDev) return;
        e.preventDefault();
        setDevOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDev]);

  const panelTransition = reduced ? { duration: 0 } : { duration: 0.25 };

  return (
    <div className="app-shell" data-testid="app-shell">
      <TitleBar />
      <TopStatusBar />
      {isDev && <DevPanel open={devOpen} onClose={() => setDevOpen(false)} />}
      <div className="shell-grid">
        <motion.aside className="shell-left" initial={false} animate={{ opacity: 1, x: 0 }} transition={panelTransition} data-testid="shell-left">
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
        <motion.aside className="shell-right" initial={false} animate={{ opacity: 1, x: 0 }} transition={panelTransition} data-testid="shell-right">
          <RightPanel />
        </motion.aside>
      </div>
      <CommandBar />
      <ActivityLog />
    </div>
  );
}
