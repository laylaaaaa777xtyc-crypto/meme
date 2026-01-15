import React, { useRef, useMemo, Suspense, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Environment, useTexture } from '@react-three/drei';
import { EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { AppMode, GestureState, PhotoData } from '../types';

// --- SHADERS ---

// Vertex Shader: Solid structure, no wobble
const particleVertexShader = `
  precision highp float;
  
  uniform float uTime;
  uniform float uExpand; // 0 = Tree, 1 = Cloud
  uniform float uPixelRatio; 
  
  attribute vec3 aTargetPos; 
  attribute float aSize;     
  attribute float aRandom;   
  attribute vec3 aColor;     
  
  varying vec3 vColor;
  
  #define PI 3.14159265359

  vec3 rotateY(vec3 v, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
  }

  void main() {
    vColor = aColor;
    
    // --- 1. Base Positions ---
    vec3 posTree = position;
    vec3 posCloud = aTargetPos;
    
    // --- 2. Tree Mode: Stable Rotation ---
    // Remove vertical pulse to keep it "Pure" and solid
    float treeSpeed = 0.1; 
    float treeAngle = uTime * treeSpeed;
    posTree = rotateY(posTree, treeAngle);
    
    // --- 3. Cloud Mode: Galaxy Vortex ---
    float distToCenter = length(posCloud.xz);
    float galaxySpeed = 0.05;
    float vortexAngle = (8.0 / (distToCenter + 0.5)) + (distToCenter * 0.1); 
    float cloudRot = uTime * galaxySpeed + vortexAngle;
    
    float dir = aRandom > 0.5 ? 1.0 : 0.8; 
    posCloud = rotateY(posCloud, cloudRot * dir);
    
    // --- 4. Morphing ---
    float smoothExpand = smoothstep(0.0, 1.0, uExpand);
    vec3 currentPos = mix(posTree, posCloud, smoothExpand);
    
    // Very subtle hover
    currentPos.y += sin(uTime * 0.3 + aRandom * 10.0) * 0.02; 
    
    vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
    
    // --- 5. Size Calculation ---
    // No twinkling size modification, stable size
    float calculatedSize = (aSize * (800.0 / -mvPosition.z)) * uPixelRatio;
    
    // Ensure visibility on mobile
    gl_PointSize = max(calculatedSize, 4.0 * uPixelRatio);
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment Shader: Solid Circle (No Glow)
const particleFragmentShader = `
  precision highp float;
  
  varying vec3 vColor;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    
    // Hard cutoff for solid "ball" look, with slight antialiasing
    float alpha = 1.0 - smoothstep(0.48, 0.5, dist);
    
    if (alpha < 0.01) discard;
    
    // Pure color, no transparency gradient
    gl_FragColor = vec4(vColor, 1.0); 
  }
`;

// --- ORNAMENTS (Particle System) ---
const OrnamentSystem = ({ mode }: { mode: AppMode }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 7500; // Increased count for denser tree
  const { viewport } = useThree();
  
  const { positions, targetPositions, colors, sizes, randoms } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const rnd = new Float32Array(count);
    
    // Palette: Natural Pine + Classic Ornaments
    const leafColors = [
        new THREE.Color('#1a472a'), // Deep Green
        new THREE.Color('#2d6a4f'), // Forest Green
        new THREE.Color('#40916c'), // Lighter Green
        new THREE.Color('#081c15'), // Dark Shadow Green
    ];
    
    const ornamentColors = [
        new THREE.Color('#d90429'), // Red
        new THREE.Color('#ffd700'), // Gold
        new THREE.Color('#e0e1dd'), // Silver/White
        new THREE.Color('#00b4d8'), // Ice Blue
    ];

    for (let i = 0; i < count; i++) {
      // --- 1. Tree Positions (Cone) ---
      const h = Math.random() * 14 - 7; 
      const hNorm = (h + 7) / 14; 
      const radiusMaxAtHeight = (1.0 - hNorm) * 6.0; 
      
      // Volume distribution
      let rRatio = Math.sqrt(Math.random()); 
      // Push slightly more points to surface for "leafy" look
      if (Math.random() > 0.3) rRatio = 0.7 + 0.3 * rRatio;

      const r = rRatio * radiusMaxAtHeight;
      const theta = h * 10.0 + Math.random() * Math.PI * 2; 

      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = h;
      pos[i * 3 + 2] = Math.sin(theta) * r;

      // --- 2. Cloud Positions ---
      const isDisc = Math.random() > 0.3;
      let x, y, z;
      if (isDisc) {
         const rCloud = 4.0 + Math.pow(Math.random(), 2.0) * 18.0; 
         const thetaCloud = Math.random() * Math.PI * 2;
         y = (Math.random() - 0.5) * 3.0; 
         x = rCloud * Math.cos(thetaCloud);
         z = rCloud * Math.sin(thetaCloud);
      } else {
         const rCloud = 14.0 + Math.random() * 10.0;
         const thetaCloud = Math.random() * Math.PI * 2;
         const phiCloud = Math.acos(2 * Math.random() - 1);
         x = rCloud * Math.sin(phiCloud) * Math.cos(thetaCloud);
         y = rCloud * Math.sin(phiCloud) * Math.sin(thetaCloud);
         z = rCloud * Math.cos(phiCloud);
      }

      target[i * 3] = x;
      target[i * 3 + 1] = y;
      target[i * 3 + 2] = z;

      // --- 3. Colors & Sizes ---
      // 85% Leaves, 15% Ornaments
      const isOrnament = Math.random() > 0.85;
      
      let color: THREE.Color;
      let size: number;
      
      if (isOrnament) {
          color = ornamentColors[Math.floor(Math.random() * ornamentColors.length)];
          // Ornaments are larger
          size = Math.random() * 3.0 + 3.0; 
      } else {
          color = leafColors[Math.floor(Math.random() * leafColors.length)];
          // Leaves are smaller
          size = Math.random() * 1.5 + 1.0;
      }

      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
      
      sz[i] = size;
      rnd[i] = Math.random();
    }
    
    return { positions: pos, targetPositions: target, colors: col, sizes: sz, randoms: rnd };
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uExpand: { value: 0 },
    uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1 } 
  }), []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    const targetExpand = mode === AppMode.TREE ? 0 : 1;
    uniforms.uExpand.value = THREE.MathUtils.lerp(uniforms.uExpand.value, targetExpand, delta * 2.0);
    uniforms.uPixelRatio.value = state.gl.getPixelRatio();
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aTargetPos" count={count} array={targetPositions} itemSize={3} />
        <bufferAttribute attach="attributes-aColor" count={count} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-aRandom" count={count} array={randoms} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        uniforms={uniforms}
        transparent={true} // Still needed for anti-aliasing edges
        depthWrite={true} // Enable depth write for solid objects so they occlude each other
        blending={THREE.NormalBlending} // Normal blending for solids, not Additive
        vertexColors={false}
        toneMapped={false}
      />
    </points>
  );
};

// --- PHOTOS ---
interface PhotoPlaneProps {
  data: PhotoData;
  index: number;
  mode: AppMode;
  activeIndex: number | null;
}

const PhotoPlane: React.FC<PhotoPlaneProps> = ({ data, index, mode, activeIndex }) => {
  const texture = useTexture(data.url);
  const meshRef = useRef<THREE.Mesh>(null);
  
  const cloudPos = useMemo(() => {
    const r = 8 + Math.random() * 5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
  }, []);

  const treePos = useMemo(() => {
    const y = (Math.random() - 0.5) * 8;
    const r = (5 - y) * 0.35 + 0.5;
    const angle = y * 5 + index;
    // Push photos slightly out from the tree surface
    return new THREE.Vector3(Math.cos(angle) * (r + 0.5), y, Math.sin(angle) * (r + 0.5));
  }, [index]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    let targetPos = new THREE.Vector3();
    let targetScale = 0.8;

    if (mode === AppMode.TREE) {
      targetPos.copy(treePos);
      targetScale = 0; // Keep photos hidden in pure tree mode per original requirement, or show them? 
      // User said "Photos through upload", usually implies they should be visible.
      // But initial spec said "Tree state: Coalesce". "Photo zoom state".
      // Let's keep them hidden in Tree mode to maintain the "Pure Tree" aesthetic unless explicit.
      // Actually, standard Christmas trees have decorations.
      // I will keep them hidden (scale 0) as per previous code to avoid cluttering the "Pure" tree, unless the user zooms.
      targetScale = 0; 
    } else if (mode === AppMode.CLOUD) {
      targetPos.copy(cloudPos);
      targetScale = 1.8;
      meshRef.current.lookAt(0,0,15); 
    } else if (mode === AppMode.ZOOM) {
      if (index === activeIndex) {
        targetPos.set(0, 0, 16); 
        targetScale = 5.0; 
      } else {
        targetPos.copy(cloudPos).multiplyScalar(3.0); 
        targetScale = 0;
      }
    }

    meshRef.current.position.lerp(targetPos, delta * 3);
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), delta * 3);
    
    if (mode === AppMode.ZOOM && index === activeIndex) {
        meshRef.current.rotation.set(0, 0, 0);
    } else {
       meshRef.current.rotation.z += delta * 0.05;
       meshRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent />
      <mesh position={[0,0,-0.01]}>
         <planeGeometry args={[1.05, 1.05]} />
         <meshBasicMaterial color="#FFD700" />
      </mesh>
    </mesh>
  );
};

const PhotoGroup: React.FC<{ photos: PhotoData[], mode: AppMode, activeIndex: number | null }> = ({ photos, mode, activeIndex }) => {
  return (
    <>
      {photos.map((photo, i) => (
        <PhotoPlane 
          key={photo.id} 
          data={photo} 
          index={i} 
          mode={mode} 
          activeIndex={activeIndex} 
        />
      ))}
    </>
  );
};

// --- MAIN SCENE ---
interface SceneProps {
  mode: AppMode;
  handState: GestureState;
  photos: PhotoData[];
  activePhotoIndex: number | null;
}

const Scene: React.FC<SceneProps> = ({ mode, handState, photos, activePhotoIndex }) => {
  const groupRef = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  
  const isMobile = viewport.width < 6.0;
  const responsiveScale = isMobile ? 0.65 : 1.0;

  useFrame((state) => {
    if (!groupRef.current) return;
    
    let targetRotY = 0;
    let targetRotX = 0;

    if (mode !== AppMode.ZOOM) {
      targetRotY = (handState.handPosition.x - 0.5) * 1.5; 
      targetRotX = (handState.handPosition.y - 0.5) * 0.5;
    }
    
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.05);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.05);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 26]} />
      <color attach="background" args={['#000000']} />
      
      <Environment preset="city" />
      
      {/* Brighter lighting for solid objects */}
      <ambientLight intensity={0.8} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#FFD700" />
      <pointLight position={[-10, 5, 10]} intensity={1.0} color="#FFFFFF" />
      
      <group ref={groupRef} scale={[responsiveScale, responsiveScale, responsiveScale]}>
        <OrnamentSystem mode={mode} />
        
        <Suspense fallback={null}>
            <PhotoGroup photos={photos} mode={mode} activeIndex={activePhotoIndex} />
        </Suspense>
        
        {/* Tree Top Star */}
        <mesh position={[0, 7.5, 0]} visible={mode === AppMode.TREE}>
           <octahedronGeometry args={[0.6]} />
           <meshBasicMaterial color="#FFD700" /> 
           <pointLight intensity={1.5} distance={15} color="#FFD700" decay={2} />
        </mesh>
      </group>

      <EffectComposer enableNormalPass={false}>
        {/* Removed Bloom for pure look */}
        <Vignette eskil={false} offset={0.1} darkness={0.8} />
      </EffectComposer>
    </>
  );
};

export default Scene;