import React, { useCallback, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import Scene from './components/Scene';
import UIOverlay from './components/UIOverlay';
import HandManager from './components/HandManager';
import FortuneCard from './components/FortuneCard';
import WishDrift, { pickRandom } from './components/WishDrift';
import GestureEffect from './components/GestureEffect';
import WishDialog from './components/WishDialog';
import { AppMode, ApiWish, FortuneCard as FortuneCardType, GestureState } from './types';
import { getRandomFortune } from './utils/fortuneData';

const IS_MOBILE = typeof navigator !== 'undefined'
  && (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches));

const GESTURE_TO_MODE: Record<string, AppMode> = {
  Open_Palm:   AppMode.LOVE,
  Pointing_Up: AppMode.CAREER,
  Closed_Fist: AppMode.HEALTH,
};

const GESTURE_TO_TYPE: Record<string, FortuneCardType['type']> = {
  Open_Palm:   'love',
  Pointing_Up: 'career',
  Closed_Fist: 'health',
};

export default function App() {
  const [mode, setMode]               = useState<AppMode>(AppMode.TREE);
  const [fortuneCard, setFortuneCard] = useState<FortuneCardType | null>(null);
  const [isCameraOn, setIsCameraOn]   = useState(false);
  const [toastMessage, setToastMsg]   = useState<string | null>(null);
  const [glLost, setGlLost]           = useState(false);
  const [wishDialogOpen, setWishDialogOpen] = useState(false);
  const [handState, setHandState]     = useState<GestureState>({
    gesture: 'Unknown',
    handPosition: { x: 0.5, y: 0.5 },
  });

  // WishDrift 的 launch 函数由子组件通过 onShake prop 注册
  const wishLaunchRef = useRef<((wishes: ApiWish[]) => void) | null>(null);
  const wishPoolRef   = useRef<ApiWish[]>([]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // 手势稳定 1.2s 后触发运势
  const handleGestureTrigger = useCallback((gesture: GestureState['gesture']) => {
    const newMode = GESTURE_TO_MODE[gesture];
    if (!newMode || fortuneCard) return;
    setMode(newMode);
    setTimeout(() => {
      const type = GESTURE_TO_TYPE[gesture];
      setFortuneCard({ type, text: getRandomFortune(type) });
    }, 900);
  }, [fortuneCard]);

  const handleCloseCard = () => {
    setFortuneCard(null);
    setMode(AppMode.TREE);
  };

  const toggleCamera = () => {
    setIsCameraOn(prev => {
      if (!prev) showToast('摄像头开启中…');
      else { showToast('摄像头已关闭'); setMode(AppMode.TREE); }
      return !prev;
    });
  };

  // 摇一摇树
  const handleShakeTree = () => {
    const pool = wishPoolRef.current;
    if (!pool.length) { showToast('还没有愿望哦，去挂一个吧～'); return; }
    const picks = pickRandom(pool, 3);
    wishLaunchRef.current?.(picks);
    showToast('✨ 他人的愿望飘来了～');
  };

  // WishDrift 注册 launch 函数
  const handleWishDriftReady = useCallback((launch: (wishes: ApiWish[]) => void) => {
    wishLaunchRef.current = launch;
  }, []);

  // 提交新愿望
  const handleWishSubmit = async (wish: string) => {
    setWishDialogOpen(false);
    try {
      const res = await fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: wish }),
      });
      if (res.ok) {
        const created: ApiWish = await res.json();
        wishPoolRef.current = [created, ...wishPoolRef.current];
        showToast('愿望已挂上树枝 ✦');
      } else {
        showToast('愿望提交失败，稍后再试');
      }
    } catch {
      showToast('网络错误，愿望暂存本地');
    }
  };

  const handleShare = () => {
    const text = '我正在「愿树·漂流」许愿，快来看看你的运势！';
    if (navigator.share) {
      navigator.share({ title: '愿树·漂流', text }).catch(() => {});
    } else {
      showToast('分享功能暂不支持此浏览器');
    }
  };

  // 同步愿望池（WishDrift 加载完后回传）
  const handlePoolLoaded = useCallback((pool: ApiWish[]) => {
    wishPoolRef.current = pool;
  }, []);

  return (
    <div
      className="w-full relative warm-bg text-white overflow-hidden font-serif-custom"
      style={{ height: '100dvh', minHeight: '-webkit-fill-available' }}
    >
      {/* 3D Scene */}
      <div className="absolute inset-0 z-0 touch-none">
        {!glLost && (
          <Canvas
            camera={{ position: [0, 0, 26], fov: IS_MOBILE ? 55 : 45 }}
            gl={{ antialias: false, powerPreference: 'high-performance', alpha: true, stencil: false, depth: true, failIfMajorPerformanceCaveat: false }}
            dpr={IS_MOBILE ? [1, 1.5] : [1, 2]}
            onCreated={({ gl }) => {
              const canvas = gl.domElement;
              canvas.addEventListener('webglcontextlost',     e => { e.preventDefault(); setGlLost(true); }, false);
              canvas.addEventListener('webglcontextrestored', ()  => setGlLost(false), false);
            }}
          >
            <Scene mode={mode} handState={handState} />
          </Canvas>
        )}
        {glLost && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-6">
            <div>
              <p className="mb-3 text-yellow-200">渲染上下文丢失，正在恢复…</p>
              <button onClick={() => location.reload()} className="px-4 py-2 rounded bg-yellow-500/20 border border-yellow-400/50 text-yellow-200">点此刷新</button>
            </div>
          </div>
        )}
      </div>

      {/* 手势特效层 */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
        <GestureEffect mode={mode} />
      </div>

      {/* 漂流愿望层 */}
      <WishDrift onShake={handleWishDriftReady} onPoolLoaded={handlePoolLoaded} />

      {/* HandManager */}
      <HandManager
        onHandUpdate={setHandState}
        onGestureTrigger={handleGestureTrigger}
        isCameraOn={isCameraOn}
        isMobile={IS_MOBILE}
      />

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <UIOverlay
          mode={mode}
          currentGesture={handState.gesture}
          isCameraOn={isCameraOn}
          onToggleCamera={toggleCamera}
          onShakeTree={handleShakeTree}
          onOpenWishDialog={() => setWishDialogOpen(true)}
          onShare={handleShare}
          isMobile={IS_MOBILE}
        />
      </div>

      {/* 运势翻牌 */}
      {fortuneCard && (
        <FortuneCard card={fortuneCard} onClose={handleCloseCard} />
      )}

      {/* 许愿弹窗 */}
      <WishDialog
        open={wishDialogOpen}
        onClose={() => setWishDialogOpen(false)}
        onSubmit={handleWishSubmit}
      />

      {/* Toast */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 bg-white/10 backdrop-blur-md border border-yellow-500/50 text-yellow-200 px-4 py-2 rounded-full shadow-[0_0_20px_rgba(255,215,0,0.3)] text-sm">
          {toastMessage}
        </div>
      )}

      <Loader />
    </div>
  );
}
