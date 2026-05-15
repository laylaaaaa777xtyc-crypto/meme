import React, { useRef } from 'react';
import { AppMode, GestureState } from '../types';

interface UIProps {
  mode: AppMode;
  currentGesture: GestureState['gesture'];
  isCameraOn: boolean;
  onToggleCamera: () => void;
  onShakeTree: () => void;
  onOpenWishDialog: () => void;
  onShare: () => void;
  isMobile?: boolean;
}

const GESTURE_HINTS = [
  { gesture: 'Open_Palm'   as const, emoji: '🖐️', label: '比心',  sub: '爱情运势', mode: AppMode.LOVE   },
  { gesture: 'Pointing_Up' as const, emoji: '☝️', label: '合十',  sub: '事业指引', mode: AppMode.CAREER },
  { gesture: 'Closed_Fist' as const, emoji: '✊', label: '握拳',  sub: '健康建议', mode: AppMode.HEALTH },
];

const UIOverlay: React.FC<UIProps> = ({
  mode,
  currentGesture,
  isCameraOn,
  onToggleCamera,
  onShakeTree,
  onOpenWishDialog,
  onShare,
  isMobile = false,
}) => {
  return (
    <div className="w-full h-full relative pointer-events-none select-none overflow-hidden font-serif-custom">

      {/* ── 标题 ── */}
      <div className="absolute top-0 left-0 w-full z-20 flex items-start px-4 pt-safe-top">
        <div className="flex-1 flex flex-col items-center gap-0.5 pt-8">
          <div className="flex items-center gap-1.5">
            <span className="sdeco d1">✦</span>
            <span className="sdeco d2 text-[0.55rem]">✧</span>
            <h1 className="wish-title mx-1">愿树·漂流</h1>
            <span className="sdeco d3 text-[0.55rem]">✧</span>
            <span className="sdeco d4">✦</span>
          </div>
          <p className="wish-subtitle">· 许下愿望，随风漂流 ·</p>
        </div>
        <button className="pointer-events-auto music-btn mt-8 flex-shrink-0">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
          </svg>
        </button>
      </div>

      {/* ── 摄像头按钮（左侧中央） ── */}
      <div
        className={`pointer-events-auto absolute left-4 z-30 cam-gold-btn ${isCameraOn ? 'cam-gold-on' : ''}`}
        style={{ top: '50%', transform: 'translateY(-50%)' }}
        onClick={onToggleCamera}
      >
        {!isCameraOn && (
          <>
            <span className="cam-gold-ring"    />
            <span className="cam-gold-ring r2" />
            <span className="cam-gold-ring r3" />
          </>
        )}
        <div className="cam-gold-circle">
          {isCameraOn ? (
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="rgba(255,210,80,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7 16 12 23 17V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="rgba(20,10,0,0.88)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7 16 12 23 17V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
          )}
        </div>
        {!isCameraOn && <div className="cam-bubble">开启手势～</div>}
        <span className="text-[12px] font-bold tracking-wide" style={{
          color: isCameraOn ? 'rgba(200,150,30,0.75)' : 'rgba(255,225,60,0.95)',
          textShadow: '0 0 10px rgba(255,200,0,0.6)',
        }}>
          {isCameraOn ? '关闭' : '手势'}
        </span>
      </div>

      {/* ── 当前手势提示（摄像头开启时） ── */}
      {isCameraOn && currentGesture !== 'Unknown' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full text-xs bg-black/50 backdrop-blur-md border border-white/15 text-white/80 pointer-events-none">
          {currentGesture === 'Open_Palm'    && '🖐️ 张开手掌 → 爱情运势'}
          {currentGesture === 'Pointing_Up'  && '☝️ 单指朝上 → 事业指引'}
          {currentGesture === 'Closed_Fist'  && '✊ 握拳 → 健康建议'}
        </div>
      )}

      {/* ── 底部栏 ── */}
      <div className="absolute bottom-0 left-0 w-full z-20">
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-none" />

        <div className="relative flex items-end justify-between px-3 pb-8 pt-5 gap-2">

          {/* 挂个愿望 */}
          <div className="pointer-events-auto flex flex-col items-center gap-1.5">
            <button className="abtn-green" onClick={onOpenWishDialog}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <div className="text-center leading-tight">
              <div className="text-[10px] text-white/85 tracking-wide">挂个愿望</div>
            </div>
          </div>

          {/* 手势提示（中央3格） */}
          <div className="flex items-end justify-center gap-4 flex-1">
            {GESTURE_HINTS.map(h => (
              <div key={h.gesture} className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${
                currentGesture === h.gesture || mode === h.mode ? 'opacity-100 scale-110' : 'opacity-55'
              }`}>
                <div className="text-[2rem] leading-none">{h.emoji}</div>
                <div className={`text-[10px] font-semibold tracking-wide mt-0.5 ${
                  mode === h.mode ? 'text-yellow-300' : 'text-white'
                }`}>{h.label}</div>
                <div className="text-[9px] text-white/50">{h.sub}</div>
              </div>
            ))}
          </div>

          {/* 右侧：摇树 + 分享 */}
          <div className="flex flex-col gap-2 items-center pointer-events-auto">
            <button className="shake-btn" onClick={onShakeTree}>
              <span className="text-[1.2rem]">🌳</span>
              <span className="text-[9px] font-bold tracking-wide mt-0.5 text-black/75">摇一摇</span>
            </button>
            <button className="abtn-gold" onClick={onShare}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="rgba(0,0,0,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>
              </svg>
            </button>
            <div className="text-[9px] text-white/50 tracking-wide">分享</div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default UIOverlay;
