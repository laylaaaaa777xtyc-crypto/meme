import React, { useRef, useMemo, Suspense, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Environment, useTexture } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { AppMode, GestureState, PhotoData } from '../types';

// --- SHADERS ---

// 顶点着色器：增加螺旋、星系旋转和闪烁动画
const particleVertexShader = `
  precision highp float;
  
  uniform float uTime;
  uniform float uExpand; // 0 = Tree, 1 = Cloud
  uniform float uPixelRatio; // 像素比，用于适配移动端高清屏
  
  attribute vec3 aTargetPos; // 散开后的目标位置 (Cloud)
  attribute float aSize;     // 粒子基础大小
  attribute float aRandom;   // 随机因子 (0.0 - 1.0)
  attribute vec3 aColor;     // 重命名颜色属性，避免冲突
  
  varying vec3 vColor;
  varying float vAlpha;      // 传递给片元的透明度
  
  #define PI 3.14159265359

  // 绕 Y 轴旋转函数
  vec3 rotateY(vec3 v, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
  }

  void main() {
    vColor = aColor;
    
    // --- 1. 基础位置读取 ---
    vec3 posTree = position;
    vec3 posCloud = aTargetPos;
    
    // ============================
    // 2. 圣诞树形态：能量汇聚流光
    // ============================
    
    // A. 螺旋上升旋转
    float treeSpeed = 0.2; 
    float treeTwist = posTree.y * 0.5; 
    float treeAngle = uTime * treeSpeed - treeTwist;
    posTree = rotateY(posTree, treeAngle);
    
    // B. 能量呼吸脉冲
    float pulse = 1.0 + 0.02 * sin(uTime * 2.0 + posTree.y * 2.0);
    posTree.x *= pulse;
    posTree.z *= pulse;
    
    // ============================
    // 3. 星云形态：星系漩涡
    // ============================
    
    float distToCenter = length(posCloud.xz);
    float galaxySpeed = 0.1;
    float vortexAngle = (8.0 / (distToCenter + 0.5)) + (distToCenter * 0.1); 
    float cloudRot = uTime * galaxySpeed + vortexAngle;
    
    float dir = aRandom > 0.5 ? 1.0 : 0.8; 
    posCloud = rotateY(posCloud, cloudRot * dir);
    
    float wave = sin(distToCenter * 0.8 - uTime * 1.5);
    posCloud.y += wave * 0.5;
    
    // ============================
    // 4. 形态混合与后处理
    // ============================
    
    float smoothExpand = smoothstep(0.0, 1.0, uExpand);
    vec3 currentPos = mix(posTree, posCloud, smoothExpand);
    
    // 5. 悬浮微动
    currentPos.y += sin(uTime * 0.5 + aRandom * 10.0) * 0.05; 
    
    // 6. 闪烁特效 (Twinkle)
    float twinkleSpeed = 2.0;
    float twinklePhase = uTime * twinkleSpeed + aRandom * 100.0;
    float twinkle = sin(twinklePhase); // -1 ~ 1
    
    // 粒子大小随闪烁变化
    float sizeMod = 0.9 + 0.3 * twinkle; 
    
    vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
    
    // 7. 大小计算 - 适配 DPR
    // 增加基础大小倍率 (x1.5) 确保移动端可见
    float calculatedSize = (aSize * sizeMod * (800.0 / -mvPosition.z)) * uPixelRatio;
    
    // 关键修复：确保最小尺寸，防止在高清屏上消失
    gl_PointSize = max(calculatedSize, 4.0 * uPixelRatio);
    
    gl_Position = projectionMatrix * mvPosition;
    
    // 8. 透明度传递 - 稍微提升基础透明度，确保可见
    vAlpha = 0.6 + 0.4 * twinkle; 
  }
`;

// 片元着色器：柔和辉光
const particleFragmentShader = `
  precision highp float;
  
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    
    if (dist > 0.5) discard;
    
    // --- 辉光计算 ---
    float glow = 1.0 - (dist * 2.0);
    glow = pow(glow, 1.5); // 降低指数，让光晕更实
    
    // 增强颜色输出，防止看起来太暗
    gl_FragColor = vec4(vColor * 2.0, glow * vAlpha); 
  }
`;

// --- ORNAMENTS (Particle System) ---
const OrnamentSystem = ({ mode }: { mode: AppMode }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 4500; 
  const { viewport } = useThree();
  
  const { positions, targetPositions, colors, sizes, randoms } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const rnd = new Float32Array(count);
    
    // Palette
    const palette = [
      new THREE.Color('#FFD700'), // Gold
      new THREE.Color('#FF4500'), // Orange Red
      new THREE.Color('#DC143C'), // Crimson
      new THREE.Color('#32CD32'), // Lime Green
      new THREE.Color('#F0F8FF'), // Alice Blue
    ];

    for (let i = 0; i < count; i++) {
      // --- 1. Tree Positions ---
      const h = Math.random() * 14 - 7; 
      const hNorm = (h + 7) / 14; 
      const radiusMaxAtHeight = (1.0 - hNorm) * 6.5; 
      
      let rRatio = Math.sqrt(Math.random()); 
      if (Math.random() > 0.5) rRatio = 0.4 + 0.6 * rRatio;

      const r = rRatio * radiusMaxAtHeight;
      const theta = h * 4.0 + Math.random() * Math.PI * 2; 

      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = h;
      pos[i * 3 + 2] = Math.sin(theta) * r;

      // --- 2. Galaxy Cloud Positions ---
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

      // --- 3. Colors ---
      const color = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
      
      // --- 4. Sizes (Increased base size slightly) ---
      sz[i] = Math.random() < 0.7 ? (Math.random() * 0.8 + 0.8) : (Math.random() * 1.5 + 2.0);
      
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
    // Dynamic DPR update
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
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors={false}
        toneMapped={false} // 关键：禁用 tone mapping 以保持高亮颜色
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
    const r = (5 - y) * 0.35 + 0.5; // Slightly offset from core
    const angle = y * 5 + index;
    return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
  }, [index]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    let targetPos = new THREE.Vector3();
    let targetScale = 0.8;

    if (mode === AppMode.TREE) {
      targetPos.copy(treePos);
      targetScale = 0; // Hide photos in tree mode initially
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
  
  // Responsive Scale: 移动端 (viewport.width 小) 需要进一步缩小，避免树过宽
  // 6.0 这是一个经验值，小于这个宽度的视口通常是竖屏手机
  const isMobile = viewport.width < 6.0;
  const responsiveScale = isMobile ? 0.65 : 1.0;

  useFrame((state) => {
    if (!groupRef.current) return;
    
    let targetRotY = 0;
    let targetRotX = 0;

    if (mode !== AppMode.ZOOM) {
      // 降低手势控制的灵敏度，使其更平滑
      targetRotY = (handState.handPosition.x - 0.5) * 1.5; 
      targetRotX = (handState.handPosition.y - 0.5) * 0.5;
    }
    
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.05);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.05);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 26]} />
      {/* 显式设置背景色，确保 Bloom 和 AdditiveBlending 正常工作 */}
      <color attach="background" args={['#000000']} />
      
      <Environment preset="city" />
      
      {/* 调整亮度：由于移动端可能较暗，稍微提升基础亮度和环境光 */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={2.0} color="#FFD700" />
      
      <group ref={groupRef} scale={[responsiveScale, responsiveScale, responsiveScale]}>
        <OrnamentSystem mode={mode} />
        
        <Suspense fallback={null}>
            <PhotoGroup photos={photos} mode={mode} activeIndex={activePhotoIndex} />
        </Suspense>
        
        {/* Tree Top Star */}
        <mesh position={[0, 7.5, 0]} visible={mode === AppMode.TREE}>
           <octahedronGeometry args={[0.6]} />
           <meshBasicMaterial color="#FFFFE0" toneMapped={false} />
           <pointLight intensity={1.0} distance={15} color="#FFD700" decay={2} />
        </mesh>
      </group>

      <EffectComposer enableNormalPass={false}>
        {/* Bloom 阈值降低到 0.6，确保在不同设备屏幕上都能看到光晕 */}
        <Bloom luminanceThreshold={0.5} mipmapBlur intensity={0.8} radius={0.6} />
        <Vignette eskil={false} offset={0.1} darkness={1.0} />
      </EffectComposer>
    </>
  );
};

export default Scene;