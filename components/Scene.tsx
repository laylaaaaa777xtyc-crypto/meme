import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Environment, useTexture } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { AppMode, GestureState, PhotoData } from '../types';

// --- SHADERS ---
// 顶点着色器：处理位置变换、粒子大小和呼吸动效
const particleVertexShader = `
  uniform float uTime;
  uniform float uExpand; // 0 = Tree, 1 = Cloud
  
  attribute vec3 aTargetPos; // 散开后的目标位置
  attribute float aSize;     // 粒子大小
  attribute float aRandom;   // 随机因子
  
  varying vec3 vColor;
  
  void main() {
    vColor = color;
    
    // 1. 位置混合：在树形态(position)和云形态(aTargetPos)之间插值
    vec3 currentPos = mix(position, aTargetPos, uExpand);
    
    // 2. 悬浮/呼吸噪点运动
    // 在散开状态下运动幅度更大，树状态下轻微浮动
    float noiseFreq = 0.5;
    float noiseAmp = 0.05 + (uExpand * 0.3); // Reduced amplitude slightly
    
    currentPos.x += sin(uTime * noiseFreq + aRandom * 10.0) * noiseAmp;
    currentPos.y += cos(uTime * noiseFreq * 0.8 + aRandom * 20.0) * noiseAmp;
    currentPos.z += sin(uTime * noiseFreq * 1.2 + aRandom * 30.0) * noiseAmp;
    
    // 3. 螺旋上升效果 (当 uExpand 变化时增加一点旋转动态)
    if (uExpand > 0.0 && uExpand < 1.0) {
        float angle = uExpand * 3.14;
        float s = sin(angle);
        float c = cos(angle);
        float x = currentPos.x;
        float z = currentPos.z;
        currentPos.x = x * c - z * s;
        currentPos.z = x * s + z * c;
    }

    vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
    
    // 4. 大小衰减：距离相机越近越大
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// 片元着色器：绘制发光的粒子纹理
const particleFragmentShader = `
  varying vec3 vColor;
  
  void main() {
    // 计算距离中心的距离 (0.0 到 0.5)
    float d = distance(gl_PointCoord, vec2(0.5));
    
    // 丢弃圆形以外的像素
    if (d > 0.5) discard;
    
    // 制作辉光效果：中心亮，边缘柔和
    // glow = 1.0 - (d * 2.0) 是线性渐变
    // pow(glow, 2.0) 让光晕更聚拢，减少整体过曝
    float glow = 1.0 - (d * 2.0);
    glow = pow(glow, 2.0); // Increased power for tighter glow

    // 稍微降低透明度，避免过度重叠变白
    gl_FragColor = vec4(vColor, glow * 0.8); 
  }
`;

// --- ORNAMENTS (Particle System) ---
// 使用 Points 而不是 InstancedMesh，实现更密集、更梦幻的粒子效果
const OrnamentSystem = ({ mode }: { mode: AppMode }) => {
  const pointsRef = useRef<THREE.Points>(null);
  // 增加粒子数量以达到参考图的密集效果
  const count = 2500; 
  
  // 生成几何体数据
  const { positions, targetPositions, colors, sizes, randoms } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const rnd = new Float32Array(count);
    
    // 调暗一点颜色，防止 Bloom 过曝
    const palette = [
      new THREE.Color('#D8BFD8'), // Thistle (Muted Purple/White)
      new THREE.Color('#FFD700'), // Gold
      new THREE.Color('#B8860B'), // Dark Goldenrod
      new THREE.Color('#8FBC8F'), // Dark Sea Green (Muted Green)
      new THREE.Color('#CD5C5C'), // Indian Red (Muted Red)
    ];

    for (let i = 0; i < count; i++) {
      // 1. 初始位置 (Tree Shape - Spiral Cone)
      const h = Math.random() * 12 - 6; 
      const radiusBase = (6 - h) * 0.5; 
      const r = Math.random() * radiusBase; 
      const theta = Math.random() * Math.PI * 2 * 6 + h;

      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = h;
      pos[i * 3 + 2] = Math.sin(theta) * r;

      // 2. 目标位置 (Cloud Shape)
      const phi = Math.acos(2 * Math.random() - 1);
      const sqrtRand = Math.cbrt(Math.random()); 
      const rCloud = 18 * sqrtRand; 
      const thetaCloud = Math.random() * 2 * Math.PI;

      target[i * 3] = rCloud * Math.sin(phi) * Math.cos(thetaCloud);
      target[i * 3 + 1] = rCloud * Math.sin(phi) * Math.sin(thetaCloud);
      target[i * 3 + 2] = rCloud * Math.cos(phi);

      // 3. 颜色
      const color = palette[Math.floor(Math.random() * palette.length)];
      // 降低亮度倍数，原来是 1.5，现在保持 1.0 或略低
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
      
      // 4. 大小
      sz[i] = Math.random() * 1.2 + 0.3; // 稍微调小一点
      
      // 5. 随机因子
      rnd[i] = Math.random();
    }
    
    return { positions: pos, targetPositions: target, colors: col, sizes: sz, randoms: rnd };
  }, []);

  // Shader Uniforms
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uExpand: { value: 0 }
  }), []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    const targetExpand = mode === AppMode.TREE ? 0 : 1;
    uniforms.uExpand.value = THREE.MathUtils.lerp(uniforms.uExpand.value, targetExpand, delta * 2);
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
    let targetRot = new THREE.Euler(0, 0, 0);

    if (mode === AppMode.TREE) {
      targetPos.copy(treePos);
      targetScale = 0; 
    } else if (mode === AppMode.CLOUD) {
      targetPos.copy(cloudPos);
      targetScale = 1.5;
      meshRef.current.lookAt(0,0,15); 
    } else if (mode === AppMode.ZOOM) {
      if (index === activeIndex) {
        targetPos.set(0, 0, 9); 
        targetScale = 4.5;
        targetRot.set(0, 0, 0);
        meshRef.current.lookAt(state.camera.position);
      } else {
        targetPos.copy(cloudPos).multiplyScalar(2.5); 
        targetScale = 0;
      }
    }

    meshRef.current.position.lerp(targetPos, delta * 3);
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), delta * 3);
    if (mode !== AppMode.ZOOM || index !== activeIndex) {
       meshRef.current.rotation.z += delta * 0.1;
    } else {
       meshRef.current.rotation.set(0,0,0);
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent />
      <mesh position={[0,0,-0.01]}>
         <planeGeometry args={[1.05, 1.05]} />
         <meshBasicMaterial color="#DAA520" />
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
    const targetRotY = (handState.handPosition.x - 0.5) * 2; 
    const targetRotX = (handState.handPosition.y - 0.5) * 0.8;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.05);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.05);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 16]} />
      <Environment preset="city" />
      
      {/* 调整光照：降低亮度 */}
      <ambientLight intensity={0.1} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#FFD700" />
      
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
        
        {/* Tree Top Star (Adjusted brightness) */}
        <mesh position={[0, 6.2, 0]} visible={mode === AppMode.TREE}>
           <octahedronGeometry args={[0.5]} />
           <meshBasicMaterial color="#FFF" />
           <pointLight intensity={1.5} distance={8} color="#FFD700" decay={2} />
        </mesh>
      </group>

      {/* 调整 Post Processing：更柔和的 Bloom */}
      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={0.5} mipmapBlur intensity={0.6} radius={0.5} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
    </>
  );
};

export default Scene;