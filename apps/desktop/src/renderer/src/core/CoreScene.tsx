/* eslint-disable react/no-unknown-property */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { coreParamsForState } from "./coreParamsForState.js";
import { useStateStore } from "../store/stateStore.js";
import { useAudioStore } from "../store/audioStore.js";
import { useSettingsStore } from "../store/settingsStore.js";
import { useQualityTier } from "./useQuality.js";
import { useFpsMetrics, FpsOverlay } from "./FpsOverlay.js";
import { FallbackCore } from "./FallbackCore.js";
import { CoreErrorBoundary } from "./ErrorBoundary.js";
import { useLogStore } from "../store/logStore.js";

// --- Rings ---
function Rings({ target, dt }: { target: ReturnType<typeof coreParamsForState>; dt: number }) {
  const refs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const curSpeeds = useRef<number[]>([0, 0, 0, 0, 0]);
  const curSpread = useRef(1);
  const curGlow = useRef(0.6);

  useFrame(() => {
    const capped = Math.min(dt, 0.1);
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i].current;
      if (!ref) continue;
      const tgt = target.ringSpeeds[i] ?? 0.1;
      curSpeeds.current[i] = THREE.MathUtils.damp(curSpeeds.current[i], tgt, 3, capped);
      ref.rotation.y += curSpeeds.current[i] * capped;
      // subtle tilt animation
      ref.rotation.x += Math.sin(Date.now() * 0.0002 + i) * 0.0005;
    }
    curSpread.current = THREE.MathUtils.damp(curSpread.current, target.spread, 4, capped);
    curGlow.current = THREE.MathUtils.damp(curGlow.current, target.glowIntensity, 4, capped);
    for (let i = 0; i < refs.length; i++) {
      const r = refs[i].current;
      if (r) r.scale.setScalar(1 + (i * 0.06 * (curSpread.current - 1)) + 0.5 * (curSpread.current - 1));
    }
  });

  const tilts: Array<[number, number, number]> = [
    [0.35, 0, 0],
    [0.9, 0.6, 0.2],
    [-0.4, 1.1, 0.5],
    [1.2, -0.3, 0.8],
    [0.6, 0.9, -0.4],
  ];
  const radii = [1.18, 1.32, 1.45, 1.02, 1.58];

  return (
    <>
      {refs.map((ref, i) => (
        <group key={i} ref={ref} rotation={tilts[i] as unknown as THREE.Euler}>
          <mesh>
            <torusGeometry args={[radii[i], 0.015 + (target.glowIntensity * 0.006), 10, 88]} />
            <meshStandardMaterial
              color={target.color}
              emissive={target.color}
              emissiveIntensity={target.glowIntensity * 0.9}
              transparent
              opacity={0.85}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

function WireSphere({ target, dt }: { target: ReturnType<typeof coreParamsForState>; dt: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const curPulse = useRef(0);
  const curFlicker = useRef(0);
  useFrame(({ clock }) => {
    const m = meshRef.current;
    if (!m) return;
    const capped = Math.min(dt, 0.1);
    curPulse.current = THREE.MathUtils.damp(curPulse.current, target.pulse, 5, capped);
    curFlicker.current = THREE.MathUtils.damp(curFlicker.current, target.flicker, 8, capped);
    const t = clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 1.6) * curPulse.current * 0.5;
    const flick = 1 - curFlicker.current * 0.4 * (Math.random() * 0.5 + 0.5) * (Math.sin(t * 22) * 0.5 + 0.5);
    m.scale.setScalar(pulse * flick);
    m.rotation.y += 0.05 * capped;
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.82, 32, 32]} />
      <meshStandardMaterial
        color={target.color}
        emissive={target.color}
        emissiveIntensity={target.glowIntensity * 0.55}
        wireframe
        transparent
        opacity={0.55}
      />
    </mesh>
  );
}

function InnerCore({ target, dt }: { target: ReturnType<typeof coreParamsForState>; dt: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const curPulse = useRef(0);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const capped = Math.min(dt, 0.1);
    curPulse.current = THREE.MathUtils.damp(curPulse.current, target.pulse, 6, capped);
    const t = clock.getElapsedTime();
    // speaking/listening pulse driven by audioLevel already in target.pulse
    const s = 1 + Math.sin(t * 2.2) * curPulse.current;
    m.scale.setScalar(s);
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, target.glowIntensity * 1.1, 4, capped);
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.38, 2]} />
      <meshStandardMaterial color={target.color} emissive={target.color} emissiveIntensity={0.9} transparent opacity={0.95} />
    </mesh>
  );
}

function Particles({ target, count, dt }: { target: ReturnType<typeof coreParamsForState>; count: number; dt: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const speeds = useRef<number[]>([]);
  const radii = useRef<number[]>([]);
  const phases = useRef<number[]>([]);

  useEffect(() => {
    speeds.current = Array.from({ length: count }, () => 0.2 + Math.random() * 0.6);
    radii.current = Array.from({ length: count }, () => 1.05 + Math.random() * 0.65);
    phases.current = Array.from({ length: count }, () => Math.random() * Math.PI * 2);
  }, [count]);

  const curSpeed = useRef(0.2);
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const capped = Math.min(dt, 0.1);
    curSpeed.current = THREE.MathUtils.damp(curSpeed.current, target.particleSpeed, 3, capped);
    const t = clock.getElapsedTime() * curSpeed.current;
    for (let i = 0; i < count; i++) {
      const r = radii.current[i] ?? 1.2;
      const ph = phases.current[i] ?? 0;
      const sp = speeds.current[i] ?? 0.3;
      const angle = t * sp + ph;
      // orbit on slightly tilted planes
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = Math.sin(angle * 0.7 + ph) * 0.28;
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(0.035);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // expose draw calls for overlay
    try {
      (window as unknown as { __NEXUS_GL_INFO__?: unknown }).__NEXUS_GL_INFO__ = (mesh as unknown as { parent?: { type?: string } }).parent;
    } catch {
      // ignore
    }
  });

  // Color lerp based on target amber/red
  const color = useMemo(() => new THREE.Color(target.color), [target.color]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.06, 6, 6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={target.glowIntensity} transparent opacity={0.9} />
    </instancedMesh>
  );
}

function WaveformRing({ target, audioLevel }: { target: ReturnType<typeof coreParamsForState>; audioLevel: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const scale = 1.0 + audioLevel * 0.65;
    m.scale.setScalar(scale);
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.opacity = target.waveformVisible ? 0.15 + audioLevel * 0.55 : 0.0;
  });
  if (!target.waveformVisible) return null;
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.55, 1.58, 64]} />
      <meshBasicMaterial color={target.color} transparent opacity={0.2} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ProgressRing({ visible, target }: { visible: boolean; target: ReturnType<typeof coreParamsForState> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    m.rotation.z += 0.8 * 0.016;
  });
  if (!visible) return null;
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.72, 1.78, 64, 1, 0, Math.PI * 1.35]} />
      <meshBasicMaterial color={target.color} transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

function GridFloor() {
  return (
    <group position={[0, -1.6, 0]}>
      <gridHelper args={[10, 20, new THREE.Color("#0a2a33"), new THREE.Color("#0a2a33")]} />
      {/* fog is via scene.fog */}
    </group>
  );
}

function SceneContent({
  forcedState,
  onFpsMetrics,
}: {
  forcedState?: import("@nexus/shared").AiCoreState;
  onFpsMetrics?: (m: { drawCalls: number }) => void;
}) {
  const state = useStateStore((s) => s.state);
  const curState = forcedState ?? state;
  const audioLevel = useAudioStore((s) => s.audioLevel);
  const { tier, settings } = useQualityTier();
  const { gl } = useThree();
  const [dt, setDt] = useState(0.016);
  const target = useMemo(() => coreParamsForState(curState as never, audioLevel), [curState, audioLevel]);

  // cap delta time, damp handled in children
  useFrame((_, delta) => {
    const capped = Math.min(delta, 0.1);
    setDt(capped);
    // expose render info for overlay
    try {
      (window as unknown as { __NEXUS_GL_INFO__: unknown }).__NEXUS_GL_INFO__ = gl.info;
      onFpsMetrics?.({ drawCalls: gl.info.render.calls });
    } catch {
      // ignore
    }
  });

  // bright by default – high tier has bloom and strong emissive
  return (
    <>
      <color attach="background" args={["#04070a"]} />
      <fog attach="fog" args={["#04070a", 6, 12]} />
      <ambientLight intensity={0.45} />
      <pointLight position={[2, 2, 2]} intensity={1.2} color={target.color} />
      <pointLight position={[-2, -1, 1]} intensity={0.6} color={target.color} />
      <WireSphere target={target} dt={dt} />
      <InnerCore target={target} dt={dt} />
      <Rings target={target} dt={dt} />
      <Particles target={target} count={settings.particleCount} dt={dt} />
      <WaveformRing target={target} audioLevel={audioLevel} />
      <ProgressRing visible={target.progressVisible} target={target} />
      <GridFloor />
      {settings.enableBloom && (
        <EffectComposer>
          <Bloom intensity={settings.bloomIntensity} radius={settings.bloomRadius} luminanceThreshold={0.7} luminanceSmoothing={0.18} />
          <Vignette eskil={false} offset={0.25} darkness={0.55} />
        </EffectComposer>
      )}
      {!settings.enableBloom && tier !== "high" ? null : null}
    </>
  );
}

export function CoreCanvas({ forcedState }: { forcedState?: import("@nexus/shared").AiCoreState } = {}) {
  const state = useStateStore((s) => s.state);
  const cur = forcedState ?? state;
  const audio = useAudioStore((s) => s.audioLevel);
  const simulated = useAudioStore((s) => s.isSimulated);
  const { tier, settings } = useQualityTier();
  const reduced = useSettingsStore((s) => s.effectiveReduced);
  const fpsEnabled = useSettingsStore((s) => (s as unknown as { fpsOverlay?: boolean }).fpsOverlay ?? false) || false;
  const [webglFailed, setWebglFailed] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [drawCalls, setDrawCalls] = useState(0);
  const metrics = useFpsMetrics(fpsEnabled, tier, settings.particleCount, cur);
  const logAdd = useLogStore((s) => s.addEntry);
  const [paused, setPaused] = useState(false);

  // pause when hidden/minimized
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    const onBlur = () => setPaused(true);
    const onFocus = () => setPaused(false);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    // Electron window minimize via IPC
    const nexus = (window as unknown as { nexus?: { window?: { onMaximizedChanged?: unknown; onFullscreenChanged?: unknown } } }).nexus;
    void nexus;
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const handleCreationError = () => {
    setWebglFailed(true);
    try {
      logAdd({ id: `core-${Date.now()}`, timestamp: new Date().toISOString(), level: "warn", message: "WebGL failed – showing 2D fallback", source: "system", type: "core.fallback" });
    } catch {
      // ignore
    }
  };

  if (webglFailed || contextLost) {
    return (
      <div style={{ width: "100%", height: "100%", minHeight: 320, position: "relative" }}>
        <FallbackCore state={cur as never} reason={contextLost ? "WebGL context lost" : "WebGL initialization failed"} />
        <div aria-live="polite" style={{ position: "absolute", bottom: 8, left: 8, fontSize: 11, color: "var(--text-muted)" }} data-testid="core-state-label">
          State: {cur.toUpperCase()}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="core-canvas-wrap"
      style={{ width: "100%", height: "100%", minHeight: 320, position: "relative", background: "#04070a", borderRadius: 12, overflow: "hidden" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        dpr={settings.dpr}
        gl={{ antialias: tier !== "low", powerPreference: "high-performance", alpha: false }}
        camera={{ position: [0, 1.2, 4.2], fov: 52 }}
        frameloop={paused ? "never" : "always"}
        onCreated={({ gl }) => {
          const canvas = gl.domElement as HTMLCanvasElement;
          const onLost = (e: Event) => {
            e.preventDefault();
            setContextLost(true);
            try {
              logAdd({ id: `core-${Date.now()}`, timestamp: new Date().toISOString(), level: "warn", message: "WebGL context lost – showing 2D fallback", source: "system", type: "core.fallback" });
            } catch {
              // ignore
            }
          };
          canvas.addEventListener("webglcontextlost", onLost as never, { once: true });
          // dispose on unmount
          return () => {
            try {
              canvas.removeEventListener("webglcontextlost", onLost as never);
              gl.dispose();
            } catch {
              // ignore
            }
          };
        }}
        onError={handleCreationError}
        data-testid="core-canvas"
      >
        <SceneContent forcedState={forcedState} onFpsMetrics={({ drawCalls: d }) => setDrawCalls(d)} />
      </Canvas>

      {/* accessibility state label */}
      <div aria-live="polite" data-testid="core-state-label" style={{ position: "absolute", bottom: 10, left: 10, fontSize: 11, letterSpacing: "0.08em", color: "var(--text-secondary)", background: "rgba(0,0,0,0.35)", padding: "3px 6px", borderRadius: 4 }}>
        State: {cur.toUpperCase()}
      </div>

      {simulated && audio > 0 && (
        <div data-testid="simulated-level-label" style={{ position: "absolute", top: 10, left: 10, fontSize: 10, color: "var(--amber, #ffb02e)", background: "rgba(0,0,0,0.45)", padding: "3px 6px", borderRadius: 4, border: "1px solid rgba(255,176,46,0.4)" }}>
          SIMULATED LEVEL: {audio.toFixed(2)}
        </div>
      )}

      {fpsEnabled && <FpsOverlay metrics={{ ...metrics, drawCalls, particleCount: settings.particleCount, tier, state: cur }} />}

      {/* reduced effects removes flicker via CSS – already handled in store */}
      {reduced && <style>{`[data-reduced="true"] canvas { filter: none !important; }`}</style>}
    </div>
  );
}

export function CoreWithFallback(props: { forcedState?: import("@nexus/shared").AiCoreState }) {
  const state = useStateStore((s) => s.state);
  const logAdd = useLogStore((s) => s.addEntry);
  const cur = props.forcedState ?? state;
  return (
    <CoreErrorBoundary
      fallback={
        <div style={{ width: "100%", height: 320 }}>
          <FallbackCore state={cur as never} reason="Core crashed – fallback" />
        </div>
      }
      onError={(err) => {
        try {
          logAdd({ id: `core-${Date.now()}`, timestamp: new Date().toISOString(), level: "warn", message: `Core error fallback: ${err.message}`, source: "system", type: "core.fallback" });
        } catch {
          // ignore
        }
      }}
    >
      <CoreCanvas {...props} />
    </CoreErrorBoundary>
  );
}
