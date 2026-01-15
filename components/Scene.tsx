import React, { useRef, useMemo, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Environment, useTexture } from '@react-three/drei';
import { EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { AppMode, GestureState, PhotoData } from '../types';

// --- SHADERS ---

const particleVertexShader = `
  precision highp float; // 强制高精度，防止移动端计算错误

  uniform float uTime;
  uniform float uExpand; // 0 = Tree, 1 = Cloud
  uniform float uPixelRatio; // 接收像素比
  
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
    
    vec3 posTree = position;
    vec3 posCloud = aTargetPos;
    
    // 1. Tree Animation (Stable)
    float treeSpeed = 0.1; 
    float treeAngle = uTime * treeSpeed;
    posTree = rotateY(posTree, treeAngle);
    
    // 2. Cloud Animation (Vortex)
    float distToCenter = length(posCloud.xz);
    float galaxySpeed = 0.05;
    float vortexAngle = (8.0 / (distToCenter + 0.5)) + (distToCenter * 0.1); 
    float cloudRot = uTime * galaxySpeed + vortexAngle;
    
    float dir = aRandom > 0.5 ? 1.0 : 0.8; 
    posCloud = rotateY(posCloud, cloudRot * dir);
    
    // 3. Morphing
    float smoothExpand = smoothstep(0.0, 1.0, uExpand);
    vec3 currentPos = mix(posTree, posCloud, smoothExpand);
    
    // Gentle Hover
    currentPos.y += sin(uTime * 0.5 + aRandom * 10.0) * 0.03; 
    
    vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
    
    // 4. Size Calculation - CRITICAL FOR MOBILE
    // (Base Size * Perspective) * PixelRatio
    float computedSize = (aSize * (800.0 / -mvPosition.z)) * uPixelRatio;
    
    // 强制最小尺寸，防止在手机高分屏上变成不可见的 1px
    gl_PointSize = max(computedSize, 4.0 * uPixelRatio);
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragmentShader = `
  precision highp float;
  
  varying vec3 vColor;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    
    // 圆形裁剪，边缘稍微抗锯齿，实心显示
    float alpha = 1.0 - smoothstep(0.45, 0.5, dist);
    
    if (alpha < 0.1) discard;
    
    // 输出纯色，不透明，确保亮度
    gl_FragColor = vec4(vColor, 1.0); 
  }
`;

// --- ORNAMENTS (Particle System) ---
const OrnamentSystem = ({ mode }: { mode: AppMode }) => {
  const pointsRef = useRef<THREE.Points>(null);
  // 增加粒子数量以获得更茂密的效果
  const count = 6500; 
  const { viewport } = useThree();
  
  const { positions, targetPositions, colors, sizes, randoms } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const rnd = new Float32Array(count);
    
    // Palette
    const leafColors = [
        new THREE.Color('#1a472a'), // Deep Green
        new THREE.Color('#2d6a4f'), // Forest Green
        new THREE.Color('#40916c'), // Lighter Green
        new THREE.Color('#081c15'), // Dark Shadow
    ];
    const ornamentColors = [
        new THREE.Color('#FFD700'), // Gold
        new THREE.Color('#D90429'), // Red
        new THREE.Color('#E0E1DD'), // Silver
    ];

    for (let i = 0; i < count; i++) {
      // Tree Shape
      const h = Math.random() * 14 - 7; 
      const hNorm = (h + 7) / 14; 
      const radiusMaxAtHeight = (1.0 - hNorm) * 6.5; 
      let rRatio = Math.sqrt(Math.random()); 
      if (Math.random() > 0.3) rRatio = 0.6 + 0.4 * rRatio; // Push to surface
      const r = rRatio * radiusMaxAtHeight;
      const theta = h * 8.0 + Math.random() * Math.PI * 2; 

      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = h;
      pos[i * 3 + 2] = Math.sin(theta) * r;

      // Cloud Shape
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

      // Color & Size
      const isOrnament = Math.random() > 0.85;
      const color = isOrnament 
        ? ornamentColors[Math.floor(Math.random() * ornamentColors.length)]
        : leafColors[Math.floor(Math.random() * leafColors.length)];
      
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
      
      // Increased base sizes for mobile visibility
      sz[i] = isOrnament ? (Math.random() * 2.0 + 2.5) : (Math.random() * 1.5 + 1.2);
      
      rnd[i] = Math.random();
    }
    
    return { positions: pos, targetPositions: target, colors: col, sizes: sz, randoms: rnd };
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uExpand: { value: 0 },
    uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1.0 }
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
        transparent={false} // 实心渲染，避免透明度问题导致看不清
        depthWrite={true}   // 开启深度写入，正确遮挡
        blending={THREE.NormalBlending} // 正常混合，非叠加
        vertexColors={false}
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
    const r = (5 - y) * 0.35 + 0.6;
    const angle = y * 5 + index;
    return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
  }, [index]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    let targetPos = new THREE.Vector3();
    let targetScale = 0.8;

    if (mode === AppMode.TREE) {
      targetPos.copy(treePos);
      targetScale = 0; // Hide photos in tree mode
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
  
  // Mobile check
  const isMobile = viewport.width < 5.0;
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
      <Environment preset="city" />
      
      {/* 显著提升灯光亮度，确保手机上可见 */}
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
           <pointLight intensity={1.0} distance={15} color="#FFD700" decay={2} />
        </mesh>
      </group>

      <EffectComposer enableNormalPass={false}>
         <Vignette eskil={false} offset={0.1} darkness={0.8} />
      </EffectComposer>
    </>
  );
};

export default Scene;