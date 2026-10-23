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

// --- Radial glow behind core (procedural canvas texture, no external asset) ---
function createRadialTexture(color: string) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // hex to rgba
  const c = new THREE.Color(color);
  grad.addColorStop(0, `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},0.55)`);
  grad.addColorStop(0.25, `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},0.22)`);
  grad.addColorStop(0.55, `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},0.06)`);
  grad.addColorStop(1, `rgba(0,0,0,0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function RadialGlow({ color, intensity, dt }: { color: string; intensity: number; dt: number }) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const tex = useMemo(() => createRadialTexture(color), [color]);
  const curScale = useRef(2.2);
  const curOpacity = useRef(0.5);
  useEffect(() => {
    return () => {
      tex.dispose();
    };
  }, [tex]);
  useFrame(() => {
    const s = spriteRef.current;
    if (!s) return;
    const capped = Math.min(dt, 0.1);
    curScale.current = THREE.MathUtils.damp(curScale.current, 2.25 + intensity * 0.9, 2.5, capped);
    curOpacity.current = THREE.MathUtils.damp(curOpacity.current, 0.45 + intensity * 0.28, 3, capped);
    s.scale.setScalar(curScale.current);
    (s.material as THREE.SpriteMaterial).opacity = curOpacity.current;
  });
  return (
    <sprite ref={spriteRef} position={[0, 0, -1.8]}>
      <spriteMaterial map={tex} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} opacity={0.5} />
    </sprite>
  );
}

// --- Rings (5 main) ---
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
            <torusGeometry args={[radii[i], 0.018 + curGlow.current * 0.01, 12, 96]} />
            <meshStandardMaterial
              color={target.color}
              emissive={target.color}
              emissiveIntensity={target.glowIntensity * 1.55}
              transparent
              opacity={0.92}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

function OuterRings({ color, spread, dt }: { color: string; spread: number; dt: number }) {
  const g1 = useRef<THREE.Group>(null);
  const g2 = useRef<THREE.Group>(null);
  const g3 = useRef<THREE.Group>(null);
  const curSpread = useRef(1);
  useFrame(() => {
    const capped = Math.min(dt, 0.1);
    curSpread.current = THREE.MathUtils.damp(curSpread.current, spread, 3, capped);
    for (const g of [g1, g2, g3]) {
      const ref = g.current;
      if (!ref) continue;
      ref.rotation.y += 0.04 * capped;
      ref.scale.setScalar(curSpread.current);
    }
  });
  return (
    <>
      <group ref={g1} rotation={[0.2, 0.4, 0]}>
        <mesh>
          <torusGeometry args={[1.92, 0.004, 8, 128]} />
          <meshBasicMaterial color={color} transparent opacity={0.14} />
        </mesh>
      </group>
      <group ref={g2} rotation={[0.9, -0.2, 0.3]}>
        <mesh>
          <torusGeometry args={[2.08, 0.0035, 8, 128]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} />
        </mesh>
      </group>
      <group ref={g3} rotation={[-0.3, 1.0, -0.2]}>
        <mesh>
          <torusGeometry args={[2.22, 0.003, 8, 128]} />
          <meshBasicMaterial color={color} transparent opacity={0.08} />
        </mesh>
      </group>
    </>
  );
}

function WireSphere({ target, dt, reduced }: { target: ReturnType<typeof coreParamsForState>; dt: number; reduced: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const curPulse = useRef(0);
  const curFlicker = useRef(0);
  useFrame(({ clock }) => {
    const m = meshRef.current;
    if (!m) return;
    const capped = Math.min(dt, 0.1);
    curPulse.current = THREE.MathUtils.damp(curPulse.current, target.pulse, 5, capped);
    const rf = reduced ? 0 : target.flicker;
    curFlicker.current = THREE.MathUtils.damp(curFlicker.current, rf, 8, capped);
    const t = clock.getElapsedTime();
    const breath = reduced ? 1 + Math.sin(t * 1.1) * curPulse.current * 0.28 : 1 + Math.sin(t * 1.6) * curPulse.current * 0.5;
    const flick = curFlicker.current > 0.01 ? 1 - curFlicker.current * 0.4 * (Math.random() * 0.5 + 0.5) * (Math.sin(t * 22) * 0.5 + 0.5) : 1;
    m.scale.setScalar(breath * flick);
    m.rotation.y += 0.05 * capped;
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.82, 32, 32]} />
      <meshStandardMaterial
        color={target.color}
        emissive={target.color}
        emissiveIntensity={0.22}
        wireframe
        transparent
        opacity={0.32}
      />
    </mesh>
  );
}

function InnerCore({ target, dt, reduced }: { target: ReturnType<typeof coreParamsForState>; dt: number; reduced: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const curPulse = useRef(0);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const capped = Math.min(dt, 0.1);
    // speaking/listening pulse driven by audioLevel already in target.pulse; reduced removes strong pulse
    const tgtPulse = reduced ? Math.min(target.pulse, 0.08) : target.pulse;
    curPulse.current = THREE.MathUtils.damp(curPulse.current, tgtPulse, 6, capped);
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 2.2) * curPulse.current;
    m.scale.setScalar(s);
    const mat = m.material as THREE.MeshStandardMaterial;
    const tgtGlow = reduced ? Math.min(target.glowIntensity * 1.35, 0.9) : target.glowIntensity * 2.1;
    mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, tgtGlow, 4, capped);
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.38, 2]} />
      <meshStandardMaterial color={target.color} emissive={target.color} emissiveIntensity={1.35} transparent opacity={0.98} />
    </mesh>
  );
}

function Particles({ target, count, dt, reduced }: { target: ReturnType<typeof coreParamsForState>; count: number; dt: number; reduced: boolean }) {
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
    const tgtSpeed = reduced ? Math.min(target.particleSpeed, 0.45) : target.particleSpeed;
    curSpeed.current = THREE.MathUtils.damp(curSpeed.current, tgtSpeed, 3, capped);
    const t = clock.getElapsedTime() * curSpeed.current;
    for (let i = 0; i < count; i++) {
      const r = radii.current[i] ?? 1.2;
      const ph = phases.current[i] ?? 0;
      const sp = speeds.current[i] ?? 0.3;
      const angle = t * sp + ph;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = Math.sin(angle * 0.7 + ph) * 0.28;
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(0.038);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  const color = useMemo(() => new THREE.Color(target.color), [target.color]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.06, 6, 6]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={reduced ? Math.min(target.glowIntensity * 1.15, 0.85) : target.glowIntensity * 1.75}
        transparent
        opacity={0.94}
      />
    </instancedMesh>
  );
}

function DustParticles({ count, dt }: { count: number; dt: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const base = useRef<Array<{ x: number; y: number; z: number; s: number; vy: number }>>([]);

  useEffect(() => {
    base.current = Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 8,
      y: (Math.random() - 0.5) * 5,
      z: (Math.random() - 0.5) * 6 - 1.2,
      s: 0.012 + Math.random() * 0.018,
      vy: 0.02 + Math.random() * 0.05,
    }));
  }, [count]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const capped = Math.min(dt, 0.1);
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const b = base.current[i];
      if (!b) continue;
      const y = b.y + Math.sin(t * b.vy + i) * 0.18;
      const x = b.x + Math.cos(t * 0.07 + i * 0.31) * 0.12 * capped * 60 * 0.02;
      dummy.position.set(x, y, b.z);
      dummy.scale.setScalar(b.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.5, 4, 4]} />
      <meshBasicMaterial color="#6bb7c7" transparent opacity={0.09} depthWrite={false} />
    </instancedMesh>
  );
}

function WaveformRing({ target, audioLevel }: { target: ReturnType<typeof coreParamsForState>; audioLevel: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const scale = 1.0 + audioLevel * 0.72;
    m.scale.setScalar(scale);
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.opacity = target.waveformVisible ? 0.18 + audioLevel * 0.58 : 0.0;
  });
  if (!target.waveformVisible) return null;
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.55, 1.595, 96]} />
      <meshBasicMaterial color={target.color} transparent opacity={0.22} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ProgressRing({ visible, target }: { visible: boolean; target: ReturnType<typeof coreParamsForState> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    m.rotation.z += 0.95 * 0.016;
  });
  if (!visible) return null;
  // white-cyan accents: main cyan arc + thin white highlight
  return (
    <group>
      <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.72, 1.785, 96, 1, 0, Math.PI * 1.42]} />
        <meshBasicMaterial color={target.color} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0.42]}>
        <ringGeometry args={[1.735, 1.76, 96, 1, 0, Math.PI * 0.55]} />
        <meshBasicMaterial color="#e6f0ff" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function GridFloor() {
  return (
    <group position={[0, -1.62, 0]}>
      <gridHelper args={[10, 20, new THREE.Color("#0a2a33"), new THREE.Color("#0a2a33")]} />
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
  const reduced = useSettingsStore((s) => s.effectiveReduced);
  const { gl } = useThree();
  const [dt, setDt] = useState(0.016);
  const target = useMemo(() => coreParamsForState(curState as never, audioLevel), [curState, audioLevel]);

  useFrame((_, delta) => {
    const capped = Math.min(delta, 0.1);
    setDt(capped);
    try {
      (window as unknown as { __NEXUS_GL_INFO__: unknown }).__NEXUS_GL_INFO__ = gl.info;
      onFpsMetrics?.({ drawCalls: gl.info.render.calls });
    } catch {
      // ignore
    }
  });

  // bloom tuning per tier – high clearly visible on bright elements, wireframe stays subtle
  const bloomCfg = useMemo(() => {
    if (tier === "high") return { intensity: 1.55, radius: 0.82, threshold: 0.32, smoothing: 0.2 };
    if (tier === "medium") return { intensity: 1.0, radius: 0.65, threshold: 0.42, smoothing: 0.18 };
    return { intensity: 0, radius: 0, threshold: 1, smoothing: 0 };
  }, [tier]);

  const showBloom = settings.enableBloom && !reduced;

  return (
    <>
      <color attach="background" args={["#04070a"]} />
      <fog attach="fog" args={["#04070a", 6.5, 13.5]} />
      <ambientLight intensity={0.55} />
      <pointLight position={[2.2, 2.2, 2.4]} intensity={1.45} color={target.color} />
      <pointLight position={[-2, -1, 1.2]} intensity={0.65} color={target.color} />
      <RadialGlow color={target.color} intensity={target.glowIntensity} dt={dt} />
      <WireSphere target={target} dt={dt} reduced={reduced} />
      <InnerCore target={target} dt={dt} reduced={reduced} />
      <Rings target={target} dt={dt} />
      <OuterRings color={target.color} spread={target.spread} dt={dt} />
      <Particles target={target} count={settings.particleCount} dt={dt} reduced={reduced} />
      {tier !== "low" && <DustParticles count={tier === "high" ? 90 : 45} dt={dt} />}
      <WaveformRing target={target} audioLevel={audioLevel} />
      <ProgressRing visible={target.progressVisible} target={target} />
      <GridFloor />
      {showBloom && (
        <EffectComposer>
          <Bloom
            intensity={bloomCfg.intensity}
            radius={bloomCfg.radius}
            luminanceThreshold={bloomCfg.threshold}
            luminanceSmoothing={bloomCfg.smoothing}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.24} darkness={0.58} />
        </EffectComposer>
      )}
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

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    const onBlur = () => setPaused(true);
    const onFocus = () => setPaused(false);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
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

      <div aria-live="polite" data-testid="core-state-label" style={{ position: "absolute", bottom: 10, left: 10, fontSize: 11, letterSpacing: "0.08em", color: "var(--text-secondary)", background: "rgba(0,0,0,0.35)", padding: "3px 6px", borderRadius: 4 }}>
        State: {cur.toUpperCase()}
      </div>

      {simulated && audio > 0 && (
        <div data-testid="simulated-level-label" style={{ position: "absolute", top: 10, left: 10, fontSize: 10, color: "var(--amber, #ffb02e)", background: "rgba(0,0,0,0.45)", padding: "3px 6px", borderRadius: 4, border: "1px solid rgba(255,176,46,0.4)" }}>
          SIMULATED LEVEL: {audio.toFixed(2)}
        </div>
      )}

      {fpsEnabled && <FpsOverlay metrics={{ ...metrics, drawCalls, particleCount: settings.particleCount, tier, state: cur }} />}

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
