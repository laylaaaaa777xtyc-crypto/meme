import React from 'react';
import { AppMode, PhotoData } from '../types';

interface UIProps {
  mode: AppMode;
  currentGesture: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isCameraOn: boolean;
  onToggleCamera: () => void;
  isMobile?: boolean;
  photos?: PhotoData[];
  onShare?: () => void;
}

// 8 Polaroid slots matching the reference image
const SLOTS: Array<React.CSSProperties & { rotate: string }> = [
  // ── left side ──
  { top: '14%', left:  '-3px', rotate: '-16deg', zIndex: 12 },
  { top: '31%', left:  '2px',  rotate: '-7deg',  zIndex: 11 },
  { top: '48%', left:  '-2px', rotate: '-4deg',  zIndex: 12 },
  { top: '64%', left:  '3px',  rotate:  '7deg',  zIndex: 11 },
  // ── right side ──
  { top: '15%', right: '-3px', rotate:  '15deg', zIndex: 12 },
  { top: '32%', right: '2px',  rotate: '-6deg',  zIndex: 11 },
  { top: '49%', right: '-2px', rotate: '-12deg', zIndex: 12 },
  { top: '65%', right: '3px',  rotate:  '8deg',  zIndex: 11 },
];

const UIOverlay: React.FC<UIProps> = ({
  mode,
  currentGesture,
  onUpload,
  isCameraOn,
  onToggleCamera,
  isMobile = false,
  photos = [],
  onShare,
}) => {
  const showPhotos = mode === AppMode.TREE;

  return (
    <div className="w-full h-full relative pointer-events-none select-none overflow-hidden font-serif-custom">

      {/* ── Header ─────────────────────────────── */}
      <div className="absolute top-0 left-0 w-full z-20 flex items-start px-4 pt-8">
        {/* Title (centered, flex-1) */}
        <div className="flex-1 flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="sdeco d1">✦</span>
            <span className="sdeco d2 text-[0.55rem]">✧</span>
            <h1 className="wish-title mx-1">光语许愿树</h1>
            <span className="sdeco d3 text-[0.55rem]">✧</span>
            <span className="sdeco d4">✦</span>
          </div>
          <p className="wish-subtitle">· 点亮每一刻，珍藏每一份美好 ·</p>
        </div>

        {/* Music button */}
        <button className="pointer-events-auto music-btn mt-0.5 flex-shrink-0">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
          </svg>
        </button>
      </div>

      {/* ── Polaroid photos (TREE mode only) ────── */}
      {showPhotos && SLOTS.map((slot, i) => {
        const photo = photos[i];
        if (!photo) return null;
        const { rotate, ...style } = slot;
        return (
          <div
            key={photo.id}
            className="absolute w-[82px] md:w-[100px] polaroid"
            style={{ ...style, transform: `rotate(${rotate})` }}
          >
            <div className="polaroid-tape" />
            <img
              src={photo.url}
              className="w-full aspect-square object-cover block"
              draggable={false}
            />
          </div>
        );
      })}

      {/* ── Bottom bar ──────────────────────────── */}
      <div className="absolute bottom-0 left-0 w-full z-20">
        {/* Dark gradient behind */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-none" />

        <div className="relative flex items-end justify-between px-4 pb-8 pt-6 gap-2">

          {/* Upload (green circle) */}
          <div className="pointer-events-auto flex flex-col items-center gap-1.5">
            <label className="abtn-green">
              <input type="file" accept="image/*" multiple onChange={onUpload} className="hidden" />
              {/* camera icon */}
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </label>
            <div className="text-center leading-tight">
              <div className="text-[10px] text-white/85 tracking-wide">上传照片</div>
              <div className="text-[9px]  text-white/45 tracking-wide">珍藏回忆</div>
            </div>
          </div>

          {/* Gesture icons (center) */}
          <div className="flex items-end justify-center gap-5 md:gap-9 flex-1">
            <GestureCard
              emoji="✊"
              label="握紧"
              sub="凝聚光芒"
              active={mode === AppMode.TREE && (isCameraOn ? currentGesture === 'Closed_Fist' : true)}
            />
            <GestureCard
              emoji="🖐"
              label="张开"
              sub="释放温暖"
              active={mode === AppMode.CLOUD && (isCameraOn ? currentGesture === 'Open_Palm' : true)}
            />
            <GestureCard
              emoji="☝️"
              label="轻触"
              sub="探索回忆"
              active={mode === AppMode.ZOOM}
            />
          </div>

          {/* Share (gold circle) */}
          <div className="pointer-events-auto flex flex-col items-center gap-1.5">
            <button className="abtn-gold" onClick={onShare}>
              {/* share icon */}
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="rgba(0,0,0,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5"  r="3"/>
                <circle cx="6"  cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.6"  y1="13.5" x2="15.4" y2="17.5"/>
                <line x1="15.4" y1="6.5"  x2="8.6"  y2="10.5"/>
              </svg>
            </button>
            <div className="text-center leading-tight">
              <div className="text-[10px] text-white/85 tracking-wide">分享心光</div>
              <div className="text-[9px]  text-white/45 tracking-wide">传递美好</div>
            </div>
          </div>

        </div>
      </div>

      {/* Camera toggle — desktop only, left-center, prominent with pulse */}
      {!isMobile && (
        <div
          className={`pointer-events-auto absolute left-4 z-30 cam-btn ${isCameraOn ? 'cam-on' : 'cam-off'}`}
          style={{ top: '50%', transform: 'translateY(-50%)' }}
          onClick={onToggleCamera}
        >
          {/* Expanding rings (only when off) */}
          {!isCameraOn && (
            <>
              <span className="cam-ring"    />
              <span className="cam-ring r2" />
              <span className="cam-ring r3" />
            </>
          )}

          {/* Circle */}
          <div className="cam-circle">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7 16 12 23 17V7z"/>
              <rect x="1" y="5" width="15" height="14" rx="2"/>
              {isCameraOn && <line x1="1" y1="1" x2="23" y2="23" stroke="white" strokeWidth="2"/>}
            </svg>
          </div>

          {/* Label */}
          <span className="text-[10px] font-semibold tracking-wide"
            style={{ color: isCameraOn ? 'rgba(200,150,40,0.8)' : 'rgba(255,215,0,0.95)',
                     textShadow: '0 0 8px rgba(255,200,0,0.6)' }}>
            {isCameraOn ? '关闭' : '摄像头'}
          </span>

          {/* Golden hand hint — only when camera is off */}
          {!isCameraOn && (
            <div className="cam-hint absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2">
              {/* pointing hand */}
              <span style={{ fontSize: '1.3rem', filter: 'drop-shadow(0 0 6px rgba(255,200,0,0.8))', color: '#FFD700' }}>
                👆
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] font-bold" style={{ color:'#FFD700', textShadow:'0 0 6px rgba(255,200,0,0.7)' }}>点击</span>
                <span className="text-[9px]"            style={{ color:'rgba(255,215,0,0.7)' }}>开启</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gesture label when camera on (desktop) */}
      {isCameraOn && !isMobile && (
        <div className="absolute top-20 right-4 z-30 flex flex-col gap-1.5 text-xs">
          <div className="bg-black/55 backdrop-blur-md px-3 py-1.5 rounded border border-white/15 text-white/80">
            手势: <span className="text-yellow-400 font-bold">{currentGesture === 'Closed_Fist' ? '✊ 握拳' : currentGesture === 'Open_Palm' ? '🖐️ 张开' : '未检测'}</span>
          </div>
        </div>
      )}

    </div>
  );
};

const GestureCard = ({
  emoji, label, sub, active,
}: {
  emoji: string; label: string; sub: string; active: boolean;
}) => (
  <div className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${active ? 'opacity-100 scale-110' : 'opacity-60'}`}>
    <div className="text-[2.4rem] md:text-[2.8rem] leading-none">{emoji}</div>
    <div className={`text-[11px] md:text-sm font-semibold tracking-wide mt-1 ${active ? 'text-yellow-300' : 'text-white'}`}>{label}</div>
    <div className="text-[9px] md:text-[11px] text-white/50">{sub}</div>
  </div>
);

export default UIOverlay;
