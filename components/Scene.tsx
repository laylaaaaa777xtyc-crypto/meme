import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { AppMode, GestureState } from '../types';

const IS_MOBILE = typeof navigator !== 'undefined'
  && (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches));

// ─── Particle tree ────────────────────────────────────────────────────────────

const particleVert = `
  precision highp float;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  attribute vec3 aTargetPos;
  attribute float aSize;
  attribute float aRandom;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;

  vec3 rotY(vec3 v, float a) {
    return vec3(v.x*cos(a)+v.z*sin(a), v.y, -v.x*sin(a)+v.z*cos(a));
  }

  void main() {
    vColor = aColor;
    vec3 pT = rotY(position, uTime*0.15 - position.y*0.5);
    pT.x *= 1.0 + 0.02*sin(uTime*2.0 + pT.y*2.0);
    pT.z *= 1.0 + 0.02*sin(uTime*2.0 + pT.y*2.0);
    pT.y += sin(uTime*0.5 + aRandom*10.0)*0.05;

    float twinkle = sin(uTime*1.5 + aRandom*100.0);
    vec4 mv = modelViewMatrix * vec4(pT, 1.0);
    float ps = aSize * (0.9+0.2*twinkle) * uSizeScale * (600.0/-mv.z) * uPixelRatio;
    gl_PointSize = clamp(ps, 1.0, 48.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = 0.30 + 0.30*twinkle;
  }
`;

const particleFrag = `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, pow(1.0-d*2.0, 3.0) * vAlpha);
  }
`;

const OrnamentSystem: React.FC<{ mode: AppMode }> = ({ mode }) => {
  const ref   = useRef<THREE.Points>(null);
  const count = IS_MOBILE ? 2000 : 5000;

  const { positions, targetPositions, colors, sizes, randoms } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const tgt = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz  = new Float32Array(count);
    const rnd = new Float32Array(count);

    // Base palette: warm gold; tint by mode
    const basePalette = [
      new THREE.Color('#FFFFFF'),
      new THREE.Color('#FFFBE8'),
      new THREE.Color('#FFE89A'),
      new THREE.Color('#FFD700'),
      new THREE.Color('#FFC040'),
      new THREE.Color('#F4A300'),
      new THREE.Color('#FFE0A0'),
    ];

    for (let i = 0; i < count; i++) {
      const h  = Math.random() * 14 - 7;
      const hN = (h + 7) / 14;
      const rMax = (1.0 - hN) * 6.5;
      let rr = Math.sqrt(Math.random());
      if (Math.random() > 0.5) rr = 0.4 + 0.6 * rr;
      const r     = rr * rMax;
      const theta = h * 4.0 + Math.random() * Math.PI * 2;
      pos[i*3]   = Math.cos(theta) * r;
      pos[i*3+1] = h;
      pos[i*3+2] = Math.sin(theta) * r;
      tgt[i*3]   = pos[i*3];
      tgt[i*3+1] = pos[i*3+1];
      tgt[i*3+2] = pos[i*3+2];

      const c = basePalette[Math.floor(Math.random() * basePalette.length)];
      col[i*3]   = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
      sz[i]  = Math.random() < 0.7 ? Math.random()*0.8+0.6 : Math.random()*1.5+1.5;
      rnd[i] = Math.random();
    }
    return { positions: pos, targetPositions: tgt, colors: col, sizes: sz, randoms: rnd };
  }, [count]);

  // Tint overlay per mode
  const modeColor = useMemo(() => {
    if (mode === AppMode.LOVE)   return new THREE.Color('#FF6B9D');
    if (mode === AppMode.CAREER) return new THREE.Color('#FFD700');
    if (mode === AppMode.HEALTH) return new THREE.Color('#4ADE80');
    return null;
  }, [mode]);

  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, IS_MOBILE ? 1.5 : 2) },
    uSizeScale:  { value: IS_MOBILE ? 1.4 : 1.0 },
  }), []);

  useFrame((state, delta) => {
    if (!ref.current) return;
    uniforms.uTime.value = state.clock.elapsedTime;

    // Gently tint particle colors toward mode color
    if (modeColor && ref.current.geometry.attributes.aColor) {
      const arr = ref.current.geometry.attributes.aColor.array as Float32Array;
      const t   = Math.min(delta * 1.5, 1);
      for (let i = 0; i < arr.length; i += 3) {
        arr[i]   += (modeColor.r - arr[i])   * t * 0.05;
        arr[i+1] += (modeColor.g - arr[i+1]) * t * 0.05;
        arr[i+2] += (modeColor.b - arr[i+2]) * t * 0.05;
      }
      ref.current.geometry.attributes.aColor.needsUpdate = true;
    }
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position"   count={count} array={positions}      itemSize={3} />
        <bufferAttribute attach="attributes-aTargetPos" count={count} array={targetPositions} itemSize={3} />
        <bufferAttribute attach="attributes-aColor"     count={count} array={colors}          itemSize={3} />
        <bufferAttribute attach="attributes-aSize"      count={count} array={sizes}           itemSize={1} />
        <bufferAttribute attach="attributes-aRandom"    count={count} array={randoms}         itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={particleVert} fragmentShader={particleFrag}
        uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// ─── Light strand (螺旋灯串) ──────────────────────────────────────────────────

const strandVert = `
  precision highp float;
  uniform float uTime;
  attribute float aPhase;
  attribute vec3 aColor;
  varying float vBright;
  varying vec3  vColor;
  void main() {
    vColor = aColor;
    float t = sin(uTime * 2.4 + aPhase);
    vBright = 0.30 + 0.70 * (t * 0.5 + 0.5);
    float rot = uTime * 0.13;
    float s = sin(rot), c = cos(rot);
    vec3 p = vec3(position.x*c + position.z*s, position.y, -position.x*s + position.z*c);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float ps = clamp(280.0 / -mv.z * (0.6 + 0.5*vBright), 2.0, 18.0);
    gl_PointSize = ps;
    gl_Position  = projectionMatrix * mv;
  }
`;

const strandFrag = `
  precision mediump float;
  varying float vBright;
  varying vec3  vColor;
  void main() {
    vec2  c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = pow(max(0.0, 1.0 - d * 3.5), 1.8);
    float halo = pow(max(0.0, 1.0 - d * 2.0), 2.4);
    float glow = clamp(core + halo * 0.55, 0.0, 1.0);
    gl_FragColor = vec4(vColor * 1.5, glow * vBright);
  }
`;

const LightStrand: React.FC = () => {
  const ref   = useRef<THREE.Points>(null);
  const count = IS_MOBILE ? 110 : 220;

  const { positions, phases, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const ph  = new Float32Array(count);
    const col = new Float32Array(count * 3);
    const bulbs = [
      { hex: '#FFFFFF', w: 0.30 }, { hex: '#FFE89A', w: 0.28 },
      { hex: '#FFD700', w: 0.12 }, { hex: '#FF4444', w: 0.15 },
      { hex: '#44DD55', w: 0.10 }, { hex: '#66AAFF', w: 0.05 },
    ];
    for (let i = 0; i < count; i++) {
      const t    = i / count;
      const h    = t * 15.0 - 7.5;
      const hN   = Math.max(0, Math.min(1, (h + 7) / 14));
      const r    = Math.max(0.1, (1.0 - hN) * 6.5 * 0.80);
      const angle = t * Math.PI * 2 * 10;
      pos[i*3]   = Math.cos(angle) * r;
      pos[i*3+1] = h;
      pos[i*3+2] = Math.sin(angle) * r;
      ph[i] = Math.random() * Math.PI * 2;
      const roll = Math.random(); let acc = 0, chosen = '#FFFFFF';
      for (const { hex, w } of bulbs) { acc += w; if (roll < acc) { chosen = hex; break; } }
      const c = new THREE.Color(chosen);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    }
    return { positions: pos, phases: ph, colors: col };
  }, [count]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(state => { uniforms.uTime.value = state.clock.elapsedTime; });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aPhase"   count={count} array={phases}    itemSize={1} />
        <bufferAttribute attach="attributes-aColor"   count={count} array={colors}    itemSize={3} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={strandVert} fragmentShader={strandFrag}
        uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// ─── Scene root ───────────────────────────────────────────────────────────────

interface SceneProps { mode: AppMode; handState: GestureState; }

const Scene: React.FC<SceneProps> = ({ mode, handState }) => {
  const groupRef = useRef<THREE.Group>(null);
  const { viewport, camera, size } = useThree();
  const [postOk] = useState(!IS_MOBILE);

  useEffect(() => {
    const p = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    p.position.z = aspect < 1 ? 26 + (1 - aspect) * 18 : 26;
    p.updateProjectionMatrix();
  }, [size.width, size.height, camera]);

  const scale = viewport.width < 5 ? 0.75 : viewport.width < 8 ? 0.9 : 1.0;

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y, (handState.handPosition.x - 0.5) * 1.5, 0.05
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x, (handState.handPosition.y - 0.5) * 0.5, 0.05
    );
  });

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 10, 10]} intensity={0.6} color="#FFD700" />

      <group ref={groupRef} scale={[scale, scale, scale]}>
        <OrnamentSystem mode={mode} />
        <LightStrand />
        <mesh position={[0, 7.5, 0]}>
          <octahedronGeometry args={[0.55]} />
          <meshBasicMaterial color="#FFFFF0" toneMapped={false} />
          <pointLight intensity={0.7} distance={14} color="#FFE060" decay={2} />
        </mesh>
      </group>

      {postOk && (
        <EffectComposer enableNormalPass={false}>
          <Bloom luminanceThreshold={0.75} mipmapBlur intensity={0.4} radius={0.65} />
          <Vignette eskil={false} offset={0.1} darkness={0.92} />
        </EffectComposer>
      )}
    </>
  );
};

export default Scene;
