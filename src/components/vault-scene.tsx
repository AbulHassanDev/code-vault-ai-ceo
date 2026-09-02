import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useTheme } from "@/components/theme-provider";

/** Critically-damped spring step — frame-rate independent, natural inertia. */
function spring(current: number, target: number, velocity: number, dt: number, stiffness = 90, damping = 14) {
  const a = (target - current) * stiffness - velocity * damping;
  const v = velocity + a * dt;
  return [current + v * dt, v] as const;
}

type Palette = {
  steel: string;
  steelDark: string;
  neon: string;
  rim: string;
  glass: string;
};

/** Orbiting AI data nodes — density drops on small viewports for 60fps on phones. */
function DataNodes({ count, color }: { count: number; color: string }) {
  const group = useRef<THREE.Group>(null);
  const nodes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const radius = 2.35 + (i % 3) * 0.4;
        const speed = 0.16 + ((i * 37) % 11) / 45;
        const tilt = ((i * 53) % 100) / 100 - 0.5;
        const phase = (i / count) * Math.PI * 2;
        const size = 0.028 + ((i * 17) % 5) / 150;
        return { radius, speed, tilt, phase, size };
      }),
    [count],
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    g.rotation.y += dt * 0.1;
    const t = state.clock.elapsedTime;
    g.children.forEach((child, i) => {
      const n = nodes[i]!;
      const angle = t * n.speed + n.phase;
      child.position.set(
        Math.cos(angle) * n.radius,
        Math.sin(angle * 1.4 + n.phase) * n.tilt * 1.6,
        Math.sin(angle) * n.radius,
      );
    });
  });

  return (
    <group ref={group}>
      {nodes.map((n, i) => (
        <mesh key={i}>
          <sphereGeometry args={[n.size, 10, 10]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Neon circuit traces etched across the vault face. */
function CircuitTraces({ color }: { color: string }) {
  const traces = useMemo(() => {
    const out: { pos: [number, number, number]; rot: number; len: number; w: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + 0.3;
      const r = 0.86 + (i % 3) * 0.16;
      out.push({
        pos: [Math.cos(angle) * r, Math.sin(angle) * r, 0],
        rot: angle + Math.PI / 2,
        len: 0.22 + ((i * 13) % 5) / 14,
        w: 0.018,
      });
    }
    return out;
  }, []);

  return (
    <group position={[0, 0, 0.235]}>
      {traces.map((t, i) => (
        <mesh key={i} position={t.pos} rotation-z={t.rot}>
          <planeGeometry args={[t.w, t.len]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.85} />
        </mesh>
      ))}
      {[0.62, 1.02, 1.32].map((r, i) => (
        <mesh key={`r${i}`}>
          <ringGeometry args={[r, r + 0.012, 96]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/** Photorealistic brushed-steel vault door with glass overlay and a glowing core. */
function VaultDoor({ p, dark, compact }: { p: Palette; dark: boolean; compact: boolean }) {
  const group = useRef<THREE.Group>(null);
  const spokes = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { pointer } = useThree();

  const state = useRef({ rx: 0, vrx: 0, ry: 0, vry: 0, spin: 0, vspin: 0, glow: 0 });

  useFrame((s, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = group.current;
    if (!g) return;
    const st = state.current;

    // Spring-driven cursor tilt with inertia.
    const [rx, vrx] = spring(st.rx, -pointer.y * 0.3, st.vrx, dt);
    const [ry, vry] = spring(st.ry, pointer.x * 0.45, st.vry, dt);
    st.rx = rx;
    st.vrx = vrx;
    st.ry = ry;
    st.vry = vry;
    g.rotation.x = rx;
    g.rotation.y = ry;
    g.position.y = Math.sin(s.clock.elapsedTime * 0.8) * 0.07;

    // Hover: mechanical unlock — the spoke handle turns with spring inertia.
    const [sp, vsp] = spring(st.spin, hovered ? Math.PI / 3 : 0, st.vspin, dt, 55, 9);
    st.spin = sp;
    st.vspin = vsp;
    if (spokes.current) spokes.current.rotation.z = sp;

    // Pulse-glow ring emitted from the core on hover.
    st.glow += dt * (hovered ? 0.85 : 0.32);
    const cycle = st.glow % 1;
    if (pulse.current) {
      const scale = 0.55 + cycle * 1.7;
      pulse.current.scale.set(scale, scale, scale);
      const mat = pulse.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - cycle) * (hovered ? 0.75 : 0.32);
    }
    if (core.current) {
      const mat = core.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (hovered ? 3.4 : 2.2) + Math.sin(s.clock.elapsedTime * 2.4) * 0.35;
    }
  });

  const steelProps = { metalness: 0.85, roughness: 0.22, envMapIntensity: dark ? 1.4 : 1.1 };

  return (
    <group
      ref={group}
      rotation={[0, -0.28, 0]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Outer frame */}
      <mesh castShadow receiveShadow rotation-x={Math.PI / 2} position={[0, 0, -0.05]}>
        <torusGeometry args={[1.72, 0.17, 20, 72]} rotation-x={Math.PI / 2} />
        <meshStandardMaterial color={p.steelDark} {...steelProps} />
      </mesh>

      {/* Door slab */}
      <mesh castShadow receiveShadow rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[1.62, 1.62, 0.42, 72]} />
        <meshStandardMaterial color={p.steel} {...steelProps} roughness={0.2} />
      </mesh>

      {/* Recessed face plate */}
      <mesh position={[0, 0, 0.225]}>
        <circleGeometry args={[1.46, 72]} />
        <meshStandardMaterial color={p.steelDark} metalness={0.9} roughness={0.32} />
      </mesh>

      <CircuitTraces color={p.neon} />

      {/* Perimeter bolts */}
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.53, Math.sin(a) * 1.53, 0.22]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.075, 0.075, 0.1, 14]} />
            <meshStandardMaterial color={p.steel} metalness={0.95} roughness={0.15} />
          </mesh>
        );
      })}

      {/* Handle spokes — rotate on hover (unlock) */}
      <group ref={spokes} position={[0, 0, 0.3]}>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} rotation-z={(i / 5) * Math.PI * 2} castShadow>
            <boxGeometry args={[0.09, 1.9, 0.07]} />
            <meshStandardMaterial color={p.steel} metalness={0.95} roughness={0.18} />
          </mesh>
        ))}
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.3, 0.3, 0.16, 32]} />
          <meshStandardMaterial color={p.steelDark} metalness={0.95} roughness={0.2} />
        </mesh>
      </group>

      {/* Glowing core seen through the glass */}
      <mesh ref={core} position={[0, 0, 0.34]}>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshStandardMaterial color={p.neon} emissive={p.neon} emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0, 0.9]} color={p.neon} intensity={dark ? 6 : 3} distance={4} />

      {/* Pulse-glow ring emitted from the core */}
      <mesh ref={pulse} position={[0, 0, 0.36]}>
        <ringGeometry args={[0.42, 0.47, 64]} />
        <meshBasicMaterial color={p.neon} toneMapped={false} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Refractive glass overlay (desktop only — transmission is GPU heavy) */}
      {!compact && (
        <mesh position={[0, 0, 0.44]}>
          <sphereGeometry args={[1.5, 40, 40, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
          <meshPhysicalMaterial
            color={p.glass}
            transmission={0.9}
            thickness={0.6}
            ior={1.5}
            roughness={0.06}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.05}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

export default function VaultScene() {
  const { theme } = useTheme();
  const dark = theme !== "light";
  const compact = typeof window !== "undefined" && window.innerWidth < 768;
  const nodeCount = compact ? 8 : 20;

  const p: Palette = dark
    ? { steel: "#3a4152", steelDark: "#1b2130", neon: "#818cf8", rim: "#8b5cf6", glass: "#c7d2fe" }
    : { steel: "#c3cad8", steelDark: "#8e98ac", neon: "#4f46e5", rim: "#7c3aed", glass: "#ffffff" };

  return (
    <Canvas
      dpr={compact ? 1 : [1, 2]}
      performance={{ min: 0.5 }}
      shadows
      camera={{ position: [0, 0.5, 6.4], fov: 42 }}
      gl={{ alpha: true, antialias: !compact, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ background: "transparent" }}
    >
      {/* 3-point lighting: key spot overhead, violet rim fill, soft ambient */}
      <ambientLight intensity={dark ? 0.35 : 0.85} />
      <spotLight
        position={[3.5, 6, 5]}
        angle={0.6}
        penumbra={0.8}
        intensity={dark ? 120 : 90}
        color="#ffffff"
        castShadow={!compact}
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-4.5, -1.5, -2.5]} intensity={dark ? 40 : 18} color={p.rim} distance={16} />
      <directionalLight position={[-2, 3, -4]} intensity={dark ? 0.8 : 1.2} color={p.neon} />

      <Environment resolution={128}>
        <Lightformer intensity={dark ? 2 : 3} position={[0, 5, 2]} scale={[10, 10, 1]} color="#ffffff" />
        <Lightformer
          intensity={dark ? 2.4 : 1.2}
          color="#6366f1"
          position={[-6, 1, -1]}
          rotation-y={Math.PI / 2}
          scale={[18, 3, 1]}
        />
        <Lightformer
          intensity={dark ? 2 : 1.2}
          color="#8b5cf6"
          position={[6, -1, 1]}
          rotation-y={-Math.PI / 2}
          scale={[18, 3, 1]}
        />
      </Environment>

      <group position={[0, 0.15, 0]}>
        <VaultDoor p={p} dark={dark} compact={compact} />
        <DataNodes count={nodeCount} color={p.neon} />
      </group>

      <ContactShadows position={[0, -2.05, 0]} opacity={0.6} blur={2.5} scale={9} far={4.5} resolution={512} />
    </Canvas>
  );
}
