import type { AiCoreState } from "@nexus/shared";

export function FallbackCore({ state, reason }: { state: AiCoreState; reason?: string }) {
  return (
    <div
      data-testid="fallback-core"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "radial-gradient(ellipse at center, rgba(0,229,255,0.12) 0%, transparent 72%)",
        border: "1px solid rgba(0,229,255,0.35)",
        borderRadius: 12,
      }}
    >
      <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
        <circle cx="70" cy="70" r="54" fill="none" stroke="var(--cyan, #00e5ff)" strokeWidth="1.6" strokeOpacity="0.9" />
        <circle cx="70" cy="70" r="42" fill="none" stroke="var(--cyan, #00e5ff)" strokeWidth="1" strokeOpacity="0.6" />
        <circle cx="70" cy="70" r="28" fill="none" stroke="var(--cyan, #00e5ff)" strokeWidth="0.8" strokeOpacity="0.4" />
        <circle cx="70" cy="70" r="14" fill="var(--cyan, #00e5ff)" fillOpacity="0.85" />
      </svg>
      <div data-testid="fallback-state" style={{ fontSize: 12, letterSpacing: "0.12em", color: "var(--cyan, #00e5ff)" }}>
        State: {state.toUpperCase()}
      </div>
      {reason && (
        <div style={{ fontSize: 10, color: "var(--text-muted)", maxWidth: 260, textAlign: "center" }}>{reason}</div>
      )}
    </div>
  );
}
