import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Environment, useTexture } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { AppMode, GestureState, PhotoData } from '../types';

// --- SHADERS ---

// 顶点着色器：增加螺旋、星系旋转和闪烁动画
const particleVertexShader = `
  uniform float uTime;
  uniform float uExpand; // 0 = Tree, 1 = Cloud
  
  attribute vec3 aTargetPos; // 散开后的目标位置 (Cloud)
  attribute float aSize;     // 粒子基础大小
  attribute float aRandom;   // 随机因子 (0.0 - 1.0)
  
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
    vColor = color;
    
    // --- 1. 基础位置读取 ---
    vec3 posTree = position;
    vec3 posCloud = aTargetPos;
    
    // ============================
    // 2. 圣诞树形态：能量汇聚流光
    // ============================
    
    // A. 螺旋上升旋转
    float treeSpeed = 0.3; // 稍微减慢旋转速度，让形态更稳定
    float treeTwist = posTree.y * 0.5; 
    float treeAngle = uTime * treeSpeed - treeTwist;
    posTree = rotateY(posTree, treeAngle);
    
    // B. 能量呼吸脉冲：大幅减小幅度，保持树的轮廓清晰
    float pulse = 1.0 + 0.03 * sin(uTime * 2.5 + posTree.y * 2.0);
    posTree.x *= pulse;
    posTree.z *= pulse;
    
    // ============================
    // 3. 星云形态：星系漩涡
    // ============================
    
    float distToCenter = length(posCloud.xz);
    float galaxySpeed = 0.15;
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
    currentPos.y += sin(uTime * 0.5 + aRandom * 10.0) * 0.05; // 减小噪点幅度
    
    // 6. 闪烁特效 (Twinkle)
    float twinkleSpeed = 3.0;
    float twinklePhase = uTime * twinkleSpeed + aRandom * 100.0;
    float twinkle = sin(twinklePhase); // -1 ~ 1
    
    // 粒子大小随闪烁变化
    float sizeMod = 0.8 + 0.4 * twinkle; // 整体略微调小
    
    vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
    
    // 7. 大小计算
    gl_PointSize = aSize * sizeMod * (500.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    
    // 8. 透明度传递 - 整体调暗
    // 基础透明度降低，防止重叠过曝
    vAlpha = 0.4 + 0.3 * twinkle; 
  }
`;

// 片元着色器：柔和辉光
const particleFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    
    if (dist > 0.5) discard;
    
    // --- 辉光计算 ---
    // 更加线性的衰减，减少核心极亮区域
    float glow = 1.0 - (dist * 2.0);
    glow = pow(glow, 1.5); 
    
    // 去掉了之前的 Hot Core 增强，让粒子看起来更像磨砂灯珠而非激光
    
    gl_FragColor = vec4(vColor, glow * vAlpha); 
  }
`;

// --- ORNAMENTS (Particle System) ---
const OrnamentSystem = ({ mode }: { mode: AppMode }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 4000; // 增加数量以填充轮廓
  
  const { positions, targetPositions, colors, sizes, randoms } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const rnd = new Float32Array(count);
    
    // 配色方案：降低亮度 (HSL lightness)
    const palette = [
      new THREE.Color('#D4AF37'), // Muted Gold
      new THREE.Color('#CD853F'), // Peru
      new THREE.Color('#B22222'), // Firebrick (Darker Red)
      new THREE.Color('#228B22'), // Forest Green (Darker Green)
      new THREE.Color('#E0FFFF'), // Light Cyan (Dimmer White)
    ];

    for (let i = 0; i < count; i++) {
      // --- 1. Tree Positions (Sharper Cone) ---
      const h = Math.random() * 14 - 7; // Height: -7 to 7
      const hNorm = (h + 7) / 14; // 0 to 1
      
      // 底部更宽，顶部更尖
      const radiusMaxAtHeight = (1.0 - hNorm) * 6.0; 
      
      // 关键修改：分布逻辑
      // 使用 Math.sqrt() 让粒子在截面上均匀分布，而不是聚集在中心
      // Math.pow(Math.random(), 0.3) 会把更多粒子推向边缘（树皮），勾勒轮廓
      let rRatio = Math.sqrt(Math.random()); 
      // 混合一点边缘倾向，让树看起来比较实
      if (Math.random() > 0.5) rRatio = 0.5 + 0.5 * rRatio;

      const r = rRatio * radiusMaxAtHeight;
      const theta = h * 3.0 + Math.random() * Math.PI * 2; 

      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = h;
      pos[i * 3 + 2] = Math.sin(theta) * r;

      // --- 2. Galaxy Cloud Positions ---
      const isDisc = Math.random() > 0.3;
      let x, y, z;
      if (isDisc) {
         const rCloud = 3.0 + Math.pow(Math.random(), 2.0) * 16.0; 
         const thetaCloud = Math.random() * Math.PI * 2;
         y = (Math.random() - 0.5) * 2.0; 
         x = rCloud * Math.cos(thetaCloud);
         z = rCloud * Math.sin(thetaCloud);
      } else {
         const rCloud = 12.0 + Math.random() * 8.0;
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
      
      // --- 4. Sizes ---
      // 增大粒子尺寸以补偿相机距离
      sz[i] = Math.random() < 0.8 ? (Math.random() * 0.8 + 0.4) : (Math.random() * 1.5 + 1.2);
      
      rnd[i] = Math.random();
    }
    
    return { positions: pos, targetPositions: target, colors: col, sizes: sz, randoms: rnd };
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uExpand: { value: 0 }
  }), []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    const targetExpand = mode === AppMode.TREE ? 0 : 1;
    uniforms.uExpand.value = THREE.MathUtils.lerp(uniforms.uExpand.value, targetExpand, delta * 2.0);
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aTargetPos" count={count} array={targetPositions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
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
        vertexColors={true}
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
    const r = (5 - y) * 0.3;
    const angle = y * 5;
    return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    let targetPos = new THREE.Vector3();
    let targetScale = 0.8;

    if (mode === AppMode.TREE) {
      targetPos.copy(treePos);
      targetScale = 0; 
    } else if (mode === AppMode.CLOUD) {
      targetPos.copy(cloudPos);
      targetScale = 1.5;
      meshRef.current.lookAt(0,0,15); 
    } else if (mode === AppMode.ZOOM) {
      if (index === activeIndex) {
        // Position centered
        // Camera is at Z=24. 
        // Old Value: Z=18 (Dist 6) -> Too Close
        // New Value: Z=14 (Dist 10) -> Better overview
        targetPos.set(0, 0, 14); 
        targetScale = 4.2; // Slightly smaller to fit screen
      } else {
        targetPos.copy(cloudPos).multiplyScalar(3.0); 
        targetScale = 0;
      }
    }

    meshRef.current.position.lerp(targetPos, delta * 3);
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), delta * 3);
    
    if (mode === AppMode.ZOOM && index === activeIndex) {
        // In zoom mode, reset rotation to face screen directly
        meshRef.current.rotation.set(0, 0, 0);
    } else {
       // Floating effect
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

// --- MAIN SCENE ---
interface SceneProps {
  mode: AppMode;
  handState: GestureState;
  photos: PhotoData[];
  activePhotoIndex: number | null;
}

const Scene: React.FC<SceneProps> = ({ mode, handState, photos, activePhotoIndex }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!groupRef.current) return;
    
    let targetRotY = 0;
    let targetRotX = 0;

    // Only allow hand rotation if NOT in zoom mode
    // When zooming, we want the world to re-center so the photo is straight
    if (mode !== AppMode.ZOOM) {
      targetRotY = (handState.handPosition.x - 0.5) * 2; 
      targetRotX = (handState.handPosition.y - 0.5) * 0.8;
    }
    
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.05);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.05);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 24]} />
      <Environment preset="city" />
      
      {/* Lights - Further reduced intensity */}
      <ambientLight intensity={0.05} />
      <pointLight position={[10, 10, 10]} intensity={0.2} color="#FFD700" />
      
      <group ref={groupRef}>
        <OrnamentSystem mode={mode} />
        {photos.map((photo, i) => (
          <PhotoPlane 
            key={photo.id} 
            data={photo} 
            index={i} 
            mode={mode} 
            activeIndex={activePhotoIndex} 
          />
        ))}
        
        {/* Tree Top Star - Dimmed */}
        <mesh position={[0, 7.2, 0]} visible={mode === AppMode.TREE}>
           <octahedronGeometry args={[0.5]} />
           <meshBasicMaterial color="#FFFFE0" />
           <pointLight intensity={1.0} distance={8} color="#FFD700" decay={2} />
        </mesh>
      </group>

      <EffectComposer enableNormalPass={false}>
        {/* Reduced Bloom intensity and increased threshold */}
        <Bloom luminanceThreshold={0.5} mipmapBlur intensity={0.5} radius={0.6} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
    </>
  );
};

export default Scene;