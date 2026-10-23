import { useEffect, useRef, useState } from "react";
import { useSettingsStore } from "../store/settingsStore.js";

export interface FpsMetrics {
  fps: number;
  drawCalls: number;
  particleCount: number;
  tier: string;
  state: string;
}

export function useFpsMetrics(enabled: boolean, tier: string, particleCount: number, state: string): FpsMetrics {
  const [fps, setFps] = useState(0);
  const [drawCalls, setDrawCalls] = useState(0);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const tick = () => {
      frameCount.current++;
      const now = performance.now();
      const elapsed = now - lastTime.current;
      if (elapsed >= 500) {
        setFps(Math.round((frameCount.current * 1000) / elapsed));
        frameCount.current = 0;
        lastTime.current = now;
        // try to read renderer info if available globally
        try {
          const glInfo = (window as unknown as { __NEXUS_GL_INFO__?: { render?: { calls?: number } } }).__NEXUS_GL_INFO__;
          if (glInfo?.render?.calls != null) setDrawCalls(glInfo.render.calls);
        } catch {
          // ignore
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  return { fps, drawCalls, particleCount, tier, state };
}

export function FpsOverlay({ metrics }: { metrics: FpsMetrics }) {
  const reduced = useSettingsStore((s) => s.effectiveReduced);
  if (reduced) return null;
  return (
    <div
      data-testid="fps-overlay"
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        background: "rgba(0,0,0,0.55)",
        border: "1px solid rgba(0,229,255,0.3)",
        borderRadius: 6,
        padding: "6px 8px",
        fontSize: 10,
        lineHeight: 1.4,
        color: "var(--cyan, #00e5ff)",
        fontFamily: "JetBrains Mono, monospace",
        zIndex: 5,
      }}
    >
      <div>FPS: {metrics.fps}</div>
      <div>Draw calls: {metrics.drawCalls}</div>
      <div>Particles: {metrics.particleCount}</div>
      <div>Quality: {metrics.tier}</div>
      <div>State: {metrics.state.toUpperCase()}</div>
    </div>
  );
}
