import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges, Environment, Lightformer, Float } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useTheme } from "@/components/theme-provider";

/** Orbiting AI data nodes — density drops on small viewports for 60fps on phones. */
function DataNodes({ count, color }: { count: number; color: string }) {
  const group = useRef<THREE.Group>(null);
  const nodes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const radius = 2.1 + (i % 3) * 0.42;
        const speed = 0.18 + ((i * 37) % 11) / 40;
        const tilt = ((i * 53) % 100) / 100 - 0.5;
        const phase = (i / count) * Math.PI * 2;
        const size = 0.035 + ((i * 17) % 5) / 130;
        return { radius, speed, tilt, phase, size };
      }),
    [count],
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    g.rotation.y += dt * 0.12;
    const t = state.clock.elapsedTime;
    g.children.forEach((child, i) => {
      const n = nodes[i]!;
      const angle = t * n.speed + n.phase;
      child.position.set(
        Math.cos(angle) * n.radius,
        Math.sin(angle * 1.4 + n.phase) * n.tilt * 1.5,
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

/** The vault itself: glass cube, glowing edges, inner wireframe polyhedron and core. */
function VaultCube({ dark }: { dark: boolean }) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);
  const { pointer } = useThree();

  const edge = dark ? "#818cf8" : "#4f46e5";
  const accent = dark ? "#a78bfa" : "#7c3aed";

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = group.current;
    if (!g) return;
    // Continuous auto-rotation + mouse parallax easing (frame-rate independent).
    g.rotation.y += dt * 0.28;
    const targetX = pointer.y * 0.32;
    const targetZ = -pointer.x * 0.18;
    const k = 1 - Math.exp(-3 * dt);
    g.rotation.x += (targetX - g.rotation.x) * k;
    g.rotation.z += (targetZ - g.rotation.z) * k;
    g.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.08;
    if (inner.current) {
      inner.current.rotation.x -= dt * 0.4;
      inner.current.rotation.y += dt * 0.55;
    }
  });

  return (
    <group ref={group}>
      <mesh castShadow>
        <boxGeometry args={[2.15, 2.15, 2.15]} />
        <meshPhysicalMaterial
          color={dark ? "#6366f1" : "#c7d2fe"}
          roughness={0.08}
          metalness={0.2}
          clearcoat={1}
          transparent
          opacity={dark ? 0.14 : 0.22}
          side={THREE.DoubleSide}
        />
        <Edges scale={1.001} threshold={15} color={edge} lineWidth={2} />
      </mesh>

      <mesh ref={inner}>
        <icosahedronGeometry args={[0.95, 1]} />
        <meshBasicMaterial color={accent} wireframe transparent opacity={dark ? 0.8 : 0.55} />
      </mesh>

      <mesh>
        <icosahedronGeometry args={[0.34, 2]} />
        <meshStandardMaterial
          color={edge}
          emissive={edge}
          emissiveIntensity={dark ? 2.4 : 0.9}
          roughness={0.25}
          toneMapped={false}
        />
      </mesh>

      {/* Vault "lock" ring */}
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.35, 0.035, 10, 64]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={dark ? 1.8 : 0.6} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function VaultScene() {
  const { theme } = useTheme();
  const dark = theme !== "light";
  const compact = typeof window !== "undefined" && window.innerWidth < 768;
  const nodeCount = compact ? 10 : 22;

  return (
    <Canvas
      dpr={compact ? 1 : [1, 2]}
      camera={{ position: [0, 0.6, 6.2], fov: 45 }}
      gl={{ alpha: true, antialias: !compact }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={dark ? 0.5 : 0.95} />
      <directionalLight position={[4, 6, 5]} intensity={dark ? 1.4 : 1.8} color={dark ? "#818cf8" : "#ffffff"} />
      <pointLight position={[-4, -2, -3]} intensity={dark ? 22 : 8} color="#8b5cf6" distance={14} />
      <Environment resolution={64}>
        <Lightformer intensity={dark ? 1.6 : 2.6} position={[0, 4, 2]} scale={[8, 8, 1]} color="#ffffff" />
        <Lightformer
          intensity={dark ? 2.2 : 1}
          color="#6366f1"
          position={[-5, 1, -1]}
          rotation-y={Math.PI / 2}
          scale={[16, 2, 1]}
        />
        <Lightformer
          intensity={dark ? 1.8 : 1}
          color="#8b5cf6"
          position={[5, -1, 1]}
          rotation-y={-Math.PI / 2}
          scale={[16, 2, 1]}
        />
      </Environment>

      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.5}>
        <VaultCube dark={dark} />
      </Float>
      <DataNodes count={nodeCount} color={dark ? "#a5b4fc" : "#4f46e5"} />
    </Canvas>
  );
}
