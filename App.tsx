import React, { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import Scene from './components/Scene';
import UIOverlay from './components/UIOverlay';
import HandManager from './components/HandManager';
import { AppMode, PhotoData, GestureState } from './types';

// Default placeholder photos
const DEFAULT_PHOTOS: PhotoData[] = Array.from({ length: 6 }).map((_, i) => ({
  id: `def-${i}`,
  url: `https://picsum.photos/500/500?random=${i + 10}`,
  aspectRatio: 1,
}));

export default function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.TREE);
  const [photos, setPhotos] = useState<PhotoData[]>(DEFAULT_PHOTOS);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  
  // Camera & Notification State
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Hand tracking state shared with Scene
  const [handState, setHandState] = useState<GestureState>({
    gesture: 'Unknown',
    isPinching: false,
    handPosition: { x: 0.5, y: 0.5 }
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos: PhotoData[] = [];
      Array.from(e.target.files).forEach((file: File) => {
        const url = URL.createObjectURL(file);
        newPhotos.push({
          id: file.name,
          url,
          aspectRatio: 1 // Simplified
        });
      });
      if (newPhotos.length > 0) {
        setPhotos(prev => [...prev, ...newPhotos]);
        showToast("照片上传成功！");
      }
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleCamera = () => {
    const nextState = !isCameraOn;
    setIsCameraOn(nextState);
    showToast(nextState ? "摄像头已开启，正在识别手势..." : "摄像头已关闭");
  };

  // Gesture Logic to State Mapping
  useEffect(() => {
    if (!isCameraOn) return; // Ignore gestures if camera is off

    if (handState.gesture === 'Closed_Fist') {
      setMode(AppMode.TREE);
      setActivePhotoIndex(null);
    } else if (handState.gesture === 'Open_Palm') {
      // Only switch to cloud if we aren't currently zoomed or if we want to cancel zoom
      if (mode !== AppMode.CLOUD) {
        setMode(AppMode.CLOUD);
        setActivePhotoIndex(null);
      }
    }

    if (handState.isPinching && mode === AppMode.CLOUD) {
      // Trigger zoom if pinching in cloud mode
      setMode(AppMode.ZOOM);
      // Pick a random photo if none selected
      setActivePhotoIndex((prev) => prev === null ? Math.floor(Math.random() * photos.length) : prev);
    }
  }, [handState.gesture, handState.isPinching, mode, photos.length, isCameraOn]);

  return (
    <div className="w-full h-screen bg-black relative text-white overflow-hidden font-serif-custom">
      
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <Canvas 
          camera={{ position: [0, 0, 12], fov: 45 }}
          gl={{ antialias: false, powerPreference: "high-performance" }}
          dpr={[1, 2]}
        >
          <Scene 
            mode={mode} 
            handState={handState} 
            photos={photos} 
            activePhotoIndex={activePhotoIndex}
          />
        </Canvas>
      </div>

      {/* Hand Tracking Logic (Invisible/Preview) */}
      <HandManager 
        onHandUpdate={setHandState} 
        isCameraOn={isCameraOn}
      />

      {/* UI Overlay Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <UIOverlay 
          mode={mode} 
          currentGesture={handState.gesture}
          onUpload={handlePhotoUpload}
          isCameraOn={isCameraOn}
          onToggleCamera={toggleCamera}
        />
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-50 bg-white/10 backdrop-blur-md border border-yellow-500/50 text-yellow-200 px-6 py-3 rounded-full shadow-[0_0_20px_rgba(255,215,0,0.3)] animate-bounce transition-all">
          {toastMessage}
        </div>
      )}

      <Loader />
    </div>
  );
}