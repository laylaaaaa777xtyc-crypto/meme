import React from 'react';
import { AppMode } from '../types';

interface UIProps {
  mode: AppMode;
  currentGesture: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isCameraOn: boolean;
  onToggleCamera: () => void;
}

const UIOverlay: React.FC<UIProps> = ({ 
  mode, 
  currentGesture, 
  onUpload, 
  isCameraOn, 
  onToggleCamera, 
}) => {
  
  const getGestureLabel = (gesture: string) => {
    switch (gesture) {
      case 'Closed_Fist': return '✊ 握拳';
      case 'Open_Palm': return '🖐️ 张开手掌';
      case 'Pointing_Up': return '👆 向上指';
      case 'Unknown': return '未检测到';
      default: return gesture;
    }
  };

  const getModeLabel = (m: AppMode) => {
    switch (m) {
      case AppMode.TREE: return '圣诞树形态';
      case AppMode.CLOUD: return '星云散开形态';
      case AppMode.ZOOM: return '照片特写模式';
      default: return m;
    }
  };

  return (
    <div className="w-full h-full relative pointer-events-none select-none overflow-hidden font-serif-custom">
      
      {/* 1. Header Area (Top) */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-20">
        <div className="mt-1 relative">
          <div className="absolute -top-5 left-1 flex gap-3 text-lg opacity-90">
             <span className="animate-bounce-soft filter drop-shadow-lg">🦌</span>
             <span className="animate-bounce-soft delay-100 filter drop-shadow-lg">🎁</span>
             <span className="animate-bounce-soft delay-200 filter drop-shadow-lg">🧦</span>
             <span className="animate-bounce-soft delay-300 filter drop-shadow-lg">❄️</span>
          </div>
          <h1 className="text-3xl md:text-4xl christmas-text mb-1 tracking-widest pt-1">
            指尖圣诞魔法
          </h1>
          <p className="text-gray-400 text-xs mt-1 max-w-md font-sans tracking-wide opacity-80 pl-1">
            用手势唤醒沉睡的圣诞精灵
          </p>
        </div>
        
        {isCameraOn && (
          <div className="flex flex-col items-end gap-2 animate-fade-in-up scale-90 origin-top-right">
              <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded border border-white/20 text-white shadow-lg text-xs md:text-sm">
                  手势: <span className="font-bold text-yellow-400">{getGestureLabel(currentGesture)}</span>
              </div>
              <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded border border-white/20 text-xs text-gray-400 shadow-lg">
                  当前状态: {getModeLabel(mode)}
              </div>
          </div>
        )}
      </div>

      {/* 2. Center Controls (Left & Right Vertical Center) */}
      <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-4 md:px-8 z-30 pointer-events-none">
        
        {/* Left: Camera Toggle */}
        <div className="pointer-events-auto relative">
             <button 
                onClick={onToggleCamera}
                className={`group relative flex flex-col items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full border-2 backdrop-blur-md transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.5)] ${
                    isCameraOn 
                    ? 'bg-red-900/40 border-red-500/50 text-red-200 hover:bg-red-900/60 hover:border-red-400' 
                    : 'bg-green-900/40 border-green-500/50 text-green-200 hover:bg-green-900/60 hover:scale-110 hover:border-green-400'
                }`}
            >
                <span className="text-2xl md:text-3xl mb-1 filter drop-shadow-md">{isCameraOn ? '📷' : '📷'}</span>
                <span className="text-[10px] md:text-xs font-bold tracking-wider uppercase">
                    {isCameraOn ? '关闭' : '开启'}
                </span>
                
                {/* Ring Pulse Effect when off (inviting user) */}
                {!isCameraOn && (
                    <>
                        <span className="absolute inset-0 rounded-full border-2 border-green-400/30 animate-ping"></span>
                        <span className="absolute inset-0 rounded-full border border-green-400/50 animate-pulse"></span>
                    </>
                )}
            </button>
            {!isCameraOn && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 w-max">
                    <div className="bg-black/60 text-yellow-300 text-xs px-3 py-1.5 rounded-r-full rounded-tl-full backdrop-blur-sm border border-yellow-500/30 animate-bounce">
                        ← 点击开启体验
                    </div>
                </div>
            )}
        </div>

        {/* Right: Upload */}
        <div className="pointer-events-auto">
            <label className="group relative flex flex-col items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full border-2 bg-black/40 border-white/20 hover:border-yellow-500/50 hover:bg-black/60 backdrop-blur-md cursor-pointer transition-all duration-300 hover:scale-105 shadow-[0_0_20px_rgba(0,0,0,0.5)] text-gray-300 hover:text-yellow-200">
                <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    onChange={onUpload}
                    className="hidden" 
                />
                <span className="text-2xl md:text-3xl mb-1 filter drop-shadow-md">🖼️</span>
                <span className="text-[10px] md:text-xs font-bold tracking-wider uppercase">上传</span>
                <div className="absolute inset-0 rounded-full border border-white/5 group-hover:border-yellow-500/30 transition-colors"></div>
            </label>
        </div>

      </div>

      {/* 3. Instructions (Bottom Center) */}
      <div className={`absolute bottom-8 left-0 w-full flex justify-center items-center gap-6 md:gap-12 text-center transition-opacity duration-1000 z-20 ${isCameraOn ? 'opacity-100' : 'opacity-30 grayscale'}`}>
         <InstructionCard 
            active={mode === AppMode.TREE && isCameraOn}
            icon="✊"
            label="握拳"
            desc="聚合"
         />
         <div className="w-px h-8 md:h-12 bg-gradient-to-b from-transparent via-yellow-500/30 to-transparent"></div>
         <InstructionCard 
            active={mode === AppMode.CLOUD && isCameraOn}
            icon="🖐️"
            label="张开"
            desc="散开"
         />
         <div className="w-px h-8 md:h-12 bg-gradient-to-b from-transparent via-yellow-500/30 to-transparent"></div>
         <InstructionCard 
            active={mode === AppMode.ZOOM && isCameraOn}
            icon="🤏"
            label="捏合"
            desc="查看"
         />
      </div>
    </div>
  );
};

const InstructionCard = ({ icon, label, desc, active }: { icon: string, label: string, desc: string, active: boolean }) => (
  <div className={`transition-all duration-500 transform ${active ? 'opacity-100 scale-110 drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]' : 'opacity-60 scale-90'}`}>
    <div className="text-3xl md:text-5xl mb-1 md:mb-3 filter drop-shadow-lg">{icon}</div>
    <div className={`font-bold text-sm md:text-lg ${active ? 'text-yellow-400' : 'text-gray-400'}`}>{label}</div>
    <div className="text-[10px] md:text-xs text-gray-300 tracking-wide">{desc}</div>
  </div>
);

export default UIOverlay;