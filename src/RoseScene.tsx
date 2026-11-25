/**
 * The one lazy 3D moment of the Rose pilot: a blooming rose built from
 * primitives (no external model), drag-to-rotate via OrbitControls.
 *
 * - Lazy-loaded (React.lazy) from stage 6 only; never on the Creator form.
 * - `bloom` 0..1 opens the petals a little more per photo enlarged.
 * - Gated by the caller behind WebGL + reduced-motion checks; the 2D CSS
 *   rose is the fallback. Small scene, DPR capped, no auto-rotate loop
 *   beyond a slow sway — mobile-friendly by design.
 */
import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { Group } from 'three'

const PETAL_COLORS = ['#ff315f', '#ff6b8c', '#d92d58', '#ff8fab']

function Petal({
  angle,
  radius,
  height,
  bloom,
  color,
  size,
}: {
  angle: number
  radius: number
  height: number
  bloom: number
  color: string
  size: number
}) {
  // Closed bud: petals point up and in. Blooming: they tilt outward.
  const tilt = -0.95 + bloom * 1.35
  return (
    <mesh
      position={[Math.cos(angle) * radius, height, Math.sin(angle) * radius]}
      rotation={[Math.sin(angle) * tilt, -angle, Math.cos(angle) * tilt]}
      scale={[size, size * 0.24, size * 1.7]}
    >
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
    </mesh>
  )
}

function Rose({ bloom }: { bloom: number }) {
  const group = useRef<Group>(null)

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.22
  })

  // Bloom opens the petals: the prop steps 0 → 1 as photos are enlarged.
  const b = bloom
  const rings: Array<{ count: number; radius: number; height: number; size: number; color: string }> = [
    { count: 5, radius: 0.28, height: 0.42, size: 0.3, color: PETAL_COLORS[0] },
    { count: 7, radius: 0.52, height: 0.18, size: 0.38, color: PETAL_COLORS[1] },
    { count: 8, radius: 0.78, height: -0.05, size: 0.46, color: PETAL_COLORS[2] },
  ]

  return (
    <group ref={group} position={[0, -0.4, 0]}>
      {/* Stem + leaves */}
      <mesh position={[0, -1.15, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 1.7, 10]} />
        <meshStandardMaterial color="#22473a" roughness={0.8} />
      </mesh>
      <mesh position={[0.3, -1.25, 0]} rotation={[0, 0, -0.7]} scale={[1, 0.25, 0.5]}>
        <sphereGeometry args={[0.32, 12, 12]} />
        <meshStandardMaterial color="#2e5c49" roughness={0.8} />
      </mesh>
      <mesh position={[-0.3, -1.5, 0]} rotation={[0, 0, 0.7]} scale={[1, 0.25, 0.5]}>
        <sphereGeometry args={[0.32, 12, 12]} />
        <meshStandardMaterial color="#2e5c49" roughness={0.8} />
      </mesh>
      {/* Petal rings — bloom opens them */}
      {rings.map((ring, ringIndex) =>
        Array.from({ length: ring.count }, (_, i) => {
          const angle = (i / ring.count) * Math.PI * 2 + ringIndex * 0.45
          return (
            <Petal
              key={`${ringIndex}-${i}`}
              angle={angle}
              radius={ring.radius}
              height={ring.height}
              bloom={b}
              color={ring.color}
              size={ring.size}
            />
          )
        }),
      )}
      {/* Heart of the rose */}
      <mesh position={[0, 0.52, 0]} scale={[0.22, 0.3, 0.22]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#7a1030" roughness={0.4} />
      </mesh>
    </group>
  )
}

export default function RoseScene({ bloom }: { bloom: number }) {
  const clamped = Math.max(0, Math.min(1, bloom))
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.7, 4.4], fov: 42 }}
      aria-label="A blooming 3D rose — drag to rotate"
      role="img"
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={1.3} />
      <pointLight position={[-2, 1, 2]} intensity={8} color="#ffd3df" />
      <Rose bloom={clamped} />
      <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={0.9} maxPolarAngle={2.1} />
    </Canvas>
  )
}
