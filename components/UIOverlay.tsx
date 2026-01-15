import React from 'react';
import { AppMode } from '../types';

interface UIProps {
  mode: AppMode;
  currentGesture: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isCameraOn: boolean;
  onToggleCamera: () => void;
}

const UIOverlay: React.FC<UIProps> = ({ mode, currentGesture, onUpload, isCameraOn, onToggleCamera }) => {
  
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
    <div className="w-full h-full flex flex-col justify-between p-8 pointer-events-none">
      
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-6xl magical-text mb-2 drop-shadow-[0_2px_10px_rgba(255,215,0,0.5)]">
            指尖圣诞魔法
          </h1>
          <p className="text-gray-300 text-sm mt-2 max-w-md font-sans tracking-wide">
            用手势唤醒沉睡的圣诞精灵
          </p>
        </div>
        
        {/* Gesture Feedback (Only visible if camera is on) */}
        {isCameraOn && (
          <div className="flex flex-col items-end gap-2 animate-fade-in-up">
              <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded border border-white/20 text-white shadow-lg">
                  手势: <span className="font-bold text-yellow-400">{getGestureLabel(currentGesture)}</span>
              </div>
              <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded border border-white/20 text-xs text-gray-400 shadow-lg">
                  当前状态: {getModeLabel(mode)}
              </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className={`flex justify-center items-center gap-12 text-center transition-opacity duration-1000 ${isCameraOn ? 'opacity-100' : 'opacity-30 grayscale'}`}>
         <InstructionCard 
            active={mode === AppMode.TREE && isCameraOn}
            icon="✊"
            label="握拳"
            desc="聚合生成圣诞树"
         />
         <div className="w-px h-16 bg-gradient-to-b from-transparent via-yellow-500/50 to-transparent"></div>
         <InstructionCard 
            active={mode === AppMode.CLOUD && isCameraOn}
            icon="🖐️"
            label="张开五指"
            desc="散开如繁星"
         />
         <div className="w-px h-16 bg-gradient-to-b from-transparent via-yellow-500/50 to-transparent"></div>
         <InstructionCard 
            active={mode === AppMode.ZOOM && isCameraOn}
            icon="🤏"
            label="捏合"
            desc="抓取查看照片"
         />
      </div>

      {/* Footer Controls */}
      <div className="flex justify-between items-end pointer-events-auto w-full">
        {/* Left: Camera Toggle */}
        <div className="flex items-center gap-4">
            <button 
                onClick={onToggleCamera}
                className={`flex items-center gap-2 px-6 py-3 rounded-full border transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.5)] ${
                    isCameraOn 
                    ? 'bg-red-900/40 border-red-500/50 text-red-200 hover:bg-red-900/60' 
                    : 'bg-green-900/40 border-green-500/50 text-green-200 hover:bg-green-900/60 hover:scale-105'
                }`}
            >
                <span className="text-xl">{isCameraOn ? '📷' : '📷'}</span>
                <span className="font-bold tracking-wider">{isCameraOn ? '关闭摄像头' : '开启魔法之眼'}</span>
            </button>
            {!isCameraOn && <span className="text-sm text-yellow-400/70 animate-pulse">← 点击这里开启体验</span>}
        </div>

        {/* Right: Upload & Info */}
        <div className="flex flex-col items-end gap-4">
            <div className="bg-black/40 backdrop-blur-md p-4 rounded-lg border border-white/10 group hover:border-yellow-500/30 transition-colors">
            <label className="flex flex-col gap-2 cursor-pointer">
                <span className="text-xs uppercase tracking-widest text-gray-400 group-hover:text-yellow-200 transition-colors">Add Memories</span>
                <input 
                type="file" 
                accept="image/*" 
                multiple 
                onChange={onUpload}
                className="hidden" 
                />
                <div className="bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded text-sm text-center">
                上传照片
                </div>
            </label>
            </div>
            
            <div className="text-xs text-gray-500 font-mono">
            Powered by Three.js & MediaPipe
            </div>
        </div>
      </div>
    </div>
  );
};

const InstructionCard = ({ icon, label, desc, active }: { icon: string, label: string, desc: string, active: boolean }) => (
  <div className={`transition-all duration-500 transform ${active ? 'opacity-100 scale-125 drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]' : 'opacity-60 scale-100'}`}>
    <div className="text-5xl mb-3 filter drop-shadow-lg">{icon}</div>
    <div className={`font-bold text-lg ${active ? 'text-yellow-400' : 'text-gray-400'}`}>{label}</div>
    <div className="text-xs text-gray-300 tracking-wide">{desc}</div>
  </div>
);

export default UIOverlay;