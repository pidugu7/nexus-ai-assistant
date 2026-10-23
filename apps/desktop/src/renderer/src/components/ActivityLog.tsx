import { motion, AnimatePresence } from "framer-motion";
import { useLogStore } from "../store/logStore.js";
import { useSettingsStore } from "../store/settingsStore.js";

export function ActivityLog() {
  const { entries, collapsed, toggleCollapsed } = useLogStore();
  const reduced = useSettingsStore((s) => s.reducedEffects);

  const transition = reduced ? { duration: 0 } : { duration: 0.25, ease: "easeInOut" as const };

  return (
    <section className="activitylog" data-testid="activity-log">
      <div className="log-header">
        <span className="log-title">ACTIVITY LOG</span>
        <span className="log-count">{entries.length} entries</span>
        <button className="log-toggle" onClick={toggleCollapsed} aria-expanded={!collapsed} type="button">
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="log-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition}
            className="log-body"
            data-testid="log-body"
          >
            {entries.length === 0 ? (
              <div className="log-entry text-muted">No entries yet</div>
            ) : (
              entries.map((e) => (
                <div key={e.id} className={`log-entry log-${e.level}`}>
                  <span className="log-time font-mono">{new Date(e.timestamp).toLocaleTimeString()}</span>
                  <span className="log-msg">{e.message}</span>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
