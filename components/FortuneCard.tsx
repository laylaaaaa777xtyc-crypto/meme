import React, { useEffect, useState } from 'react';
import { FortuneCard as FortuneCardType } from '../types';

interface Props {
  card: FortuneCardType;
  onClose: () => void;
}

const META: Record<FortuneCardType['type'], { emoji: string; label: string; color: string; glow: string }> = {
  love:   { emoji: '💗', label: '爱情运势', color: '#FF6B9D', glow: 'rgba(255,107,157,0.5)' },
  career: { emoji: '✨', label: '事业运势', color: '#FFD700', glow: 'rgba(255,215,0,0.5)'   },
  health: { emoji: '🌿', label: '健康运势', color: '#4ADE80', glow: 'rgba(74,222,128,0.5)'  },
};

const FortuneCard: React.FC<Props> = ({ card, onClose }) => {
  const [flipped, setFlipped] = useState(false);
  const meta = META[card.type];

  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 900);
    return () => clearTimeout(t);
  }, []);

  const handleShare = () => {
    const text = `【愿树·漂流 ${meta.label}】\n${card.text}\n\n来自 愿树·漂流 ✨`;
    if (navigator.share) {
      navigator.share({ title: `愿树·漂流 ${meta.label}`, text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text).then(() => alert('已复制到剪贴板'));
    }
  };

  return (
    <div className="fortune-overlay" onClick={onClose}>
      <div className="fortune-scene" onClick={e => e.stopPropagation()}>
        <div className={`fortune-flipper ${flipped ? 'is-flipped' : ''}`}>

          {/* 正面：闪光占位 */}
          <div className="fortune-face fortune-front" style={{ boxShadow: `0 0 40px ${meta.glow}` }}>
            <div className="fortune-sparkle-ring" style={{ borderColor: meta.color }} />
            <div className="fortune-sparkle-ring r2" style={{ borderColor: meta.color }} />
            <div className="fortune-front-emoji">{meta.emoji}</div>
            <div className="fortune-front-label" style={{ color: meta.color }}>{meta.label}</div>
            <div className="fortune-front-hint">翻转中…</div>
          </div>

          {/* 背面：运势文字 */}
          <div className="fortune-face fortune-back" style={{ boxShadow: `0 0 40px ${meta.glow}` }}>
            <button className="fortune-close" onClick={onClose}>×</button>
            <div className="fortune-back-emoji">{meta.emoji}</div>
            <div className="fortune-back-label" style={{ color: meta.color }}>{meta.label}</div>
            <div className="fortune-divider" style={{ background: meta.color }} />
            <p className="fortune-text">{card.text}</p>
            <button className="fortune-share-btn" style={{ background: meta.color }} onClick={handleShare}>
              分享运势
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FortuneCard;
