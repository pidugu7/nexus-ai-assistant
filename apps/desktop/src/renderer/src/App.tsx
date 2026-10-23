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
  const reduced = useSettingsStore((s) => s.effectiveReduced);
  const addEntry = useLogStore((s) => s.addEntry);
  const setEntries = useLogStore((s) => s.setEntries);
  const setState = useStateStore((s) => s.setState);
  const [devOpen, setDevOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);
  const isDev = !(window as unknown as { __NEXUS_IS_PACKAGED__?: boolean }).__NEXUS_IS_PACKAGED__;
  const fetchedRef = useRef(false);

  useEffect(() => {
    // One-time fetch of initial state/log (guard double fetch in StrictMode)
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      const nexus = (window as unknown as { nexus?: typeof window.nexus }).nexus;
      if (nexus?.log?.get) {
        nexus.log.get(200).then((entries) => {
          if (entries.length > 0) setEntries(entries);
        });
      }
      if (nexus?.state?.get) {
        nexus.state.get().then((s) => setState(s.state as never));
      }
    }
    // Subscriptions must survive StrictMode double-mount: always subscribe, cleanup on unmount
    const nexus = (window as unknown as { nexus?: typeof window.nexus }).nexus;
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
    }
    // Always subscribe to log entries for REJECTED/kill:already_idle etc.
    // Use separate subscription to avoid missing rejected events when bus exists
    if (nexus?.log?.onEntry) {
      unsubs.push(
        nexus.log.onEntry((entry) => {
          addEntry(entry as never);
        })
      );
    }
    if (nexus?.state?.onChanged) {
      unsubs.push(
        nexus.state.onChanged((p) => {
          setState((p as unknown as { to: string }).to as never);
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
    const maybeToast = (nexus as unknown as { toast?: { onToast?: (cb: (payload: { message: string; ok: boolean }) => void) => () => void } })?.toast;
    if (maybeToast?.onToast) {
      unsubs.push(
        maybeToast.onToast((payload) => {
          setToast(payload);
          window.setTimeout(() => setToast(null), 3000);
        })
      );
    }
    return () => unsubs.forEach((fn) => fn());
  }, [addEntry, setEntries, setState]);

  useEffect(() => {
    document.documentElement.setAttribute("data-reduced", String(reduced));
  }, [reduced]);

  useEffect(() => {
    if (!isDev) return;
    const nexus = (window as unknown as { nexus?: { dev?: { onToggle?: (cb: () => void) => () => void } } }).nexus;
    if (!nexus?.dev?.onToggle) return;
    const off = nexus.dev.onToggle(() => setDevOpen((v) => !v));
    return off;
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
      {toast && (
        <div
          data-testid="toast"
          style={{
            position: "fixed",
            bottom: 48,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 70,
            padding: "6px 12px",
            borderRadius: 6,
            fontSize: 11,
            background: toast.ok ? "rgba(16,185,129,0.95)" : "rgba(239,68,68,0.95)",
            color: "white",
          }}
        >
          {toast.message}
        </div>
      )}
      {isDev && (
        <button
          type="button"
          data-testid="dev-button"
          onClick={() => setDevOpen((v) => !v)}
          style={{
            position: "fixed",
            bottom: 12,
            right: 12,
            zIndex: 60,
            fontSize: 10,
            padding: "4px 8px",
            border: "1px solid var(--amber-border, #f59e0b)",
            background: "var(--bg-panel, #0b0e12)",
            color: "var(--amber, #f59e0b)",
            borderRadius: 4,
          }}
        >
          DEV
        </button>
      )}
    </div>
  );
}
