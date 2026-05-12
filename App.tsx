import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import Scene from './components/Scene';
import UIOverlay from './components/UIOverlay';
import HandManager from './components/HandManager';
import { AppMode, PhotoData, GestureState } from './types';

const IS_MOBILE = typeof navigator !== 'undefined'
  && (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches));

const DEFAULT_PHOTOS: PhotoData[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `def-${i}`,
  url: `https://picsum.photos/500/500?random=${i + 10}`,
  aspectRatio: 1,
}));

export default function App() {
  const [mode, setMode]                     = useState<AppMode>(AppMode.TREE);
  const [photos, setPhotos]                 = useState<PhotoData[]>(DEFAULT_PHOTOS);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [isCameraOn, setIsCameraOn]         = useState(false);
  const [toastMessage, setToastMessage]     = useState<string | null>(null);
  const [glLost, setGlLost]                 = useState(false);
  const sceneContainerRef                   = useRef<HTMLDivElement>(null);

  const [handState, setHandState] = useState<GestureState>({
    gesture: 'Unknown',
    isPinching: false,
    handPosition: { x: 0.5, y: 0.5 },
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const next: PhotoData[] = Array.from(e.target.files).map(f => ({
      id: f.name,
      url: URL.createObjectURL(f),
      aspectRatio: 1,
    }));
    if (next.length) { setPhotos(p => [...p, ...next]); showToast('照片上传成功！'); }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: '光语许愿树', text: '点亮每一刻，珍藏每一份美好' }).catch(() => {});
    } else {
      showToast('分享功能暂不支持此浏览器');
    }
  };

  const toggleCamera = () => {
    const next = !isCameraOn;
    setIsCameraOn(next);
    if (next) showToast('摄像头正在开启...');
    else { showToast('摄像头已关闭'); setMode(AppMode.TREE); setActivePhotoIndex(null); }
  };

  // Camera gesture → mode
  useEffect(() => {
    if (!isCameraOn) return;
    if (handState.gesture === 'Closed_Fist') { setMode(AppMode.TREE); setActivePhotoIndex(null); }
    else if (handState.gesture === 'Open_Palm' && mode !== AppMode.CLOUD) {
      setMode(AppMode.CLOUD); setActivePhotoIndex(null);
    }
    if (handState.isPinching && mode === AppMode.CLOUD) {
      setMode(AppMode.ZOOM);
      setActivePhotoIndex(p => p === null ? Math.floor(Math.random() * photos.length) : p);
    }
  }, [handState.gesture, handState.isPinching, mode, photos.length, isCameraOn]);

  // Touch / mouse → rotate + tap
  useEffect(() => {
    const el = sceneContainerRef.current;
    if (!el) return;
    let dragging = false, startX = 0, startY = 0, moved = false, startTime = 0, lastTap = 0;

    const onStart = (cx: number, cy: number) => {
      dragging = true; moved = false; startX = cx; startY = cy; startTime = performance.now();
    };
    const onMove = (cx: number, cy: number) => {
      if (!dragging) return;
      if (Math.abs(cx - startX) > 6 || Math.abs(cy - startY) > 6) moved = true;
      if (!isCameraOn) {
        setHandState({ gesture: 'Unknown', isPinching: false,
          handPosition: { x: cx / window.innerWidth, y: cy / window.innerHeight } });
      }
    };
    const onEnd = () => {
      if (!dragging) return; dragging = false;
      if (!moved && performance.now() - startTime < 350) {
        const now = performance.now();
        const dbl = now - lastTap < 320; lastTap = now;
        if (dbl) {
          setMode(prev => {
            if (prev === AppMode.ZOOM) return AppMode.CLOUD;
            setActivePhotoIndex(Math.floor(Math.random() * Math.max(photos.length, 1)));
            return AppMode.ZOOM;
          });
        } else {
          setMode(prev => {
            if (prev === AppMode.ZOOM) { setActivePhotoIndex(null); return AppMode.CLOUD; }
            return prev === AppMode.TREE ? AppMode.CLOUD : AppMode.TREE;
          });
          setActivePhotoIndex(null);
        }
      }
    };

    const ts = (e: TouchEvent) => { const t = e.touches[0]; if (t) onStart(t.clientX, t.clientY); };
    const tm = (e: TouchEvent) => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); };
    const ms = (e: MouseEvent) => onStart(e.clientX, e.clientY);
    const mm = (e: MouseEvent) => onMove(e.clientX, e.clientY);

    el.addEventListener('touchstart', ts,   { passive: true });
    el.addEventListener('touchmove',  tm,   { passive: true });
    el.addEventListener('touchend',   onEnd);
    el.addEventListener('mousedown',  ms);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup',   onEnd);
    return () => {
      el.removeEventListener('touchstart', ts);
      el.removeEventListener('touchmove',  tm);
      el.removeEventListener('touchend',   onEnd);
      el.removeEventListener('mousedown',  ms);
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup',   onEnd);
    };
  }, [isCameraOn, photos.length]);

  return (
    <div
      className="w-full relative warm-bg text-white overflow-hidden font-serif-custom"
      style={{ height: '100dvh', minHeight: '-webkit-fill-available' }}
    >
      {/* Animated bokeh dots */}
      <div className="bokeh-wrap" aria-hidden>
        <div className="bk" style={{ width:90,  height:90,  top:'12%', left:'14%',  background:'rgba(210,140,40,0.55)', animationDelay:'0s',    animationDuration:'7s'  }} />
        <div className="bk" style={{ width:70,  height:70,  top:'8%',  right:'18%', background:'rgba(200,130,35,0.5)',  animationDelay:'1.4s',  animationDuration:'8s'  }} />
        <div className="bk" style={{ width:50,  height:50,  top:'55%', left:'6%',   background:'rgba(190,115,28,0.45)', animationDelay:'2.8s',  animationDuration:'9s'  }} />
        <div className="bk" style={{ width:55,  height:55,  top:'42%', right:'5%',  background:'rgba(200,120,30,0.45)', animationDelay:'0.7s',  animationDuration:'7.5s'}} />
        <div className="bk" style={{ width:40,  height:40,  top:'6%',  left:'55%',  background:'rgba(220,150,48,0.5)',  animationDelay:'3.5s',  animationDuration:'6.5s'}} />
        <div className="bk" style={{ width:35,  height:35,  top:'70%', left:'20%',  background:'rgba(180,110,25,0.4)',  animationDelay:'5.2s',  animationDuration:'8.5s'}} />
        <div className="bk" style={{ width:45,  height:45,  top:'65%', right:'15%', background:'rgba(190,115,28,0.4)',  animationDelay:'1.9s',  animationDuration:'7.2s'}} />
      </div>

      {/* 3D Scene */}
      <div ref={sceneContainerRef} className="absolute inset-0 z-0 touch-none">
        {!glLost && (
          <Canvas
            camera={{ position: [0, 0, 26], fov: IS_MOBILE ? 55 : 45 }}
            gl={{ antialias: false, powerPreference: 'high-performance', alpha: true, stencil: false, depth: true, failIfMajorPerformanceCaveat: false }}
            dpr={IS_MOBILE ? [1, 1.5] : [1, 2]}
            onCreated={({ gl }) => {
              const canvas = gl.domElement;
              canvas.addEventListener('webglcontextlost',     (e) => { e.preventDefault(); setGlLost(true); }, false);
              canvas.addEventListener('webglcontextrestored', ()  => setGlLost(false), false);
            }}
          >
            <Scene mode={mode} handState={handState} photos={photos} activePhotoIndex={activePhotoIndex} />
          </Canvas>
        )}
        {glLost && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-6">
            <div>
              <p className="mb-3 text-yellow-200">渲染上下文丢失，正在恢复…</p>
              <button onClick={() => location.reload()}
                className="px-4 py-2 rounded bg-yellow-500/20 border border-yellow-400/50 text-yellow-200">
                点此刷新
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop hand gesture manager */}
      {!IS_MOBILE && <HandManager onHandUpdate={setHandState} isCameraOn={isCameraOn} />}

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <UIOverlay
          mode={mode}
          currentGesture={handState.gesture}
          onUpload={handlePhotoUpload}
          isCameraOn={isCameraOn}
          onToggleCamera={toggleCamera}
          isMobile={IS_MOBILE}
          photos={photos}
          onShare={handleShare}
        />
      </div>

      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 bg-white/10 backdrop-blur-md border border-yellow-500/50 text-yellow-200 px-4 py-2 rounded-full shadow-[0_0_20px_rgba(255,215,0,0.3)] text-sm">
          {toastMessage}
        </div>
      )}

      <Loader />
    </div>
  );
}
