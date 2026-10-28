"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { AtelierColors } from "@/components/providers";
import { ALL_THEME_IDS, THEME_ACCENTS } from "@/lib/tokens";

/**
 * The Gem Podium stage. Every color resolves from CSS custom properties
 * (via `colors` / the token table), so switching the atelier setting re-tints
 * the scene mid-flight. No text lives inside the canvas.
 *
 * Interaction: gentle idle drift + float bob; drag spins the stage with damped
 * inertia; cursor position adds a soft parallax tilt. Manual handlers, no
 * OrbitControls.
 */

const RING_SPECS: Array<{ radius: number; tilt: number; speed: number }> = [
  { radius: 2.75, tilt: 1.05, speed: 0.35 },
  { radius: 3.45, tilt: -0.62, speed: -0.22 },
];

function Gem({ color, position }: { color: string; position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <octahedronGeometry args={[0.21, 0]} />
      <meshPhysicalMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.35}
        roughness={0.18}
        metalness={0.55}
        clearcoat={0.7}
      />
    </mesh>
  );
}

function OrbitRing({
  index,
  radius,
  tilt,
  speed,
  accents,
  ink,
}: {
  index: 0 | 1;
  radius: number;
  tilt: number;
  speed: number;
  accents: string[];
  ink: string;
}) {
  const ring = useRef<THREE.Group>(null);
  const lineColor = useMemo(() => new THREE.Color(ink).multiplyScalar(0.6), [ink]);

  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.y = clock.getElapsedTime() * speed;
  });

  const slotCount = index === 0 ? 3 : 2;
  const slots = Array.from({ length: slotCount }, (_, k) => (k * Math.PI * 2) / slotCount);

  return (
    <group rotation={[tilt, 0, index === 0 ? 0.22 : -0.16]}>
      <group ref={ring}>
        <mesh>
          <torusGeometry args={[radius, 0.012, 12, 128]} />
          <meshBasicMaterial color={lineColor} transparent opacity={0.55} />
        </mesh>
        {slots.map((angle, i) => {
          const tokenIdx = (index * 3 + i) % accents.length;
          const color = accents[tokenIdx] ?? accents[0];
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const y = Math.sin(angle) * 0.16;
          return <Gem key={`${index}-${i}`} color={color} position={[x, y, z]} />;
        })}
      </group>
    </group>
  );
}

function Stage({
  colors,
  gemColors,
  target,
}: {
  colors: AtelierColors;
  gemColors: string[];
  target: { rx: number; ry: number };
}) {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);

  useFrame(({ clock }, delta) => {
    if (group.current) {
      const t = clock.getElapsedTime();
      const k = Math.min(1, delta * 4.5);
      group.current.rotation.y +=
        (target.ry + Math.sin(t * 0.22) * 0.12 - group.current.rotation.y) * k;
      group.current.rotation.x += (target.rx - group.current.rotation.x) * k;
    }
    if (glow.current) {
      glow.current.intensity = 1.6 + Math.sin(clock.getElapsedTime() * 1.3) * 0.25;
    }
  });

  return (
    <group ref={group}>
      <Float speed={1.3} rotationIntensity={0.08} floatIntensity={0.55}>
        {/* Glass display podium */}
        <RoundedBox args={[4.1, 0.55, 4.1]} radius={0.24} smoothness={5} position={[0, -0.9, 0]}>
          <meshPhysicalMaterial
            color={colors.surface}
            roughness={0.28}
            metalness={0.12}
            clearcoat={0.9}
            clearcoatRoughness={0.3}
            transparent
            opacity={0.94}
          />
        </RoundedBox>
        {/* Soft ring light resting on the disc */}
        <mesh position={[0, -0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.65, 0.025, 10, 96]} />
          <meshBasicMaterial color={colors.accent} toneMapped={false} />
        </mesh>
        {/* The signature gem, enshrined at center */}
        <mesh position={[0, 0.05, 0]} scale={1.12}>
          <icosahedronGeometry args={[0.5, 1]} />
          <meshPhysicalMaterial
            color={colors.accent}
            emissive={colors.accent}
            emissiveIntensity={0.22}
            roughness={0.12}
            metalness={0.5}
            clearcoat={1}
          />
        </mesh>
      </Float>

      <OrbitRing index={0} radius={RING_SPECS[0]!.radius} tilt={RING_SPECS[0]!.tilt} speed={RING_SPECS[0]!.speed} accents={gemColors} ink={colors.ink} />
      <OrbitRing index={1} radius={RING_SPECS[1]!.radius} tilt={RING_SPECS[1]!.tilt} speed={RING_SPECS[1]!.speed} accents={gemColors} ink={colors.ink} />

      {/* Wick of light under the podium */}
      <pointLight ref={glow} position={[0, -1.6, 0]} color={colors.accent} intensity={1.6} distance={7} />
    </group>
  );
}

export default function GemPodiumCanvas({ colors }: { colors: AtelierColors }) {
  const target = useRef({ rx: 0.08, ry: 0.4 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ x: 0, ryBase: 0 });

  const gemColors = useMemo(() => {
    const live = ALL_THEME_IDS.map((id) => THEME_ACCENTS.get(id) ?? colors.accent);
    live[0] = colors.accent;
    live[1] = colors.accent2;
    return live;
  }, [colors.accent, colors.accent2]);

  return (
    <div
      className="h-full w-full select-none"
      style={{ cursor: dragging ? "grabbing" : "grab" }}
      aria-label="Gem podium — drag to rotate the stage"
      role="img"
      onPointerDown={(e) => {
        setDragging(true);
        drag.current = { x: e.clientX, ryBase: target.current.ry };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (dragging) {
          target.current.ry = drag.current.ryBase + (e.clientX - drag.current.x) * 0.006;
        }
        // Cursor parallax (subtle, constant)
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        target.current.rx = 0.08 + ny * -0.1;
        target.current.ry += nx * 0.0006;
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <Canvas
        camera={{ position: [0, 0.7, 7], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.65} color={colors.ink} />
        <directionalLight position={[3.5, 5, 2.5]} intensity={1.5} color={colors.ink} />
        <directionalLight position={[-4, 2, -3]} intensity={0.5} color={colors.accent2} />
        <Stage colors={colors} gemColors={gemColors} target={target.current} />
      </Canvas>
    </div>
  );
}
