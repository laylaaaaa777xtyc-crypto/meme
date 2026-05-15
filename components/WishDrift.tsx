import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ApiWish, DriftWish } from '../types';

interface Props {
  onShake: (launch: (wishes: ApiWish[]) => void) => void;
  onPoolLoaded?: (pool: ApiWish[]) => void;
}

const MAX_ON_SCREEN = 6;

const WishDrift: React.FC<Props> = ({ onShake, onPoolLoaded }) => {
  const [pool, setPool]     = useState<ApiWish[]>([]);
  const [active, setActive] = useState<DriftWish[]>([]);
  const poolRef             = useRef<ApiWish[]>([]);

  // 加载愿望池
  useEffect(() => {
    fetch('/api/wishes')
      .then(r => r.ok ? r.json() : [])
      .then((data: ApiWish[]) => {
        poolRef.current = data;
        setPool(data);
        onPoolLoaded?.(data);
      })
      .catch(() => {});
  }, [onPoolLoaded]);

  // 注册 shake 回调
  const launch = useCallback((wishes: ApiWish[]) => {
    setActive(prev => {
      const slots = MAX_ON_SCREEN - prev.length;
      if (slots <= 0) return prev;
      const picks = wishes.slice(0, Math.min(slots, 3));
      const newItems: DriftWish[] = picks.map(w => ({
        ...w,
        x: 0.1 + Math.random() * 0.8,
        duration: 8 + Math.random() * 5,
      }));
      return [...prev, ...newItems];
    });
  }, []);

  useEffect(() => { onShake(launch); }, [onShake, launch]);

  const handleHeart = async (id: string) => {
    // 乐观更新
    setActive(prev => prev.map(w => w.id === id ? { ...w, hearts: w.hearts + 1 } : w));
    setPool(prev => {
      const next = prev.map(w => w.id === id ? { ...w, hearts: w.hearts + 1 } : w);
      poolRef.current = next;
      return next;
    });
    try { await fetch(`/api/wishes/${id}/heart`, { method: 'POST' }); } catch {}
  };

  const handleEnd = (id: string) => {
    setActive(prev => prev.filter(w => w.id !== id));
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 30 }}>
      {active.map(wish => (
        <DriftCard
          key={wish.id}
          wish={wish}
          onHeart={() => handleHeart(wish.id)}
          onEnd={() => handleEnd(wish.id)}
        />
      ))}
    </div>
  );
};

// ── 单张漂流卡 ─────────────────────────────────────────────

interface CardProps {
  wish: DriftWish;
  onHeart: () => void;
  onEnd: () => void;
}

const DriftCard: React.FC<CardProps> = ({ wish, onHeart, onEnd }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [hearted, setHearted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('animationend', onEnd, { once: true });
  }, [onEnd]);

  const handleHeart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hearted) return;
    setHearted(true);
    onHeart();
  };

  return (
    <div
      ref={ref}
      className="drift-card pointer-events-auto"
      style={{
        left: `${wish.x * 100}%`,
        animationDuration: `${wish.duration}s`,
      }}
    >
      <p className="drift-text">「{wish.text}」</p>
      <button className={`drift-heart ${hearted ? 'hearted' : ''}`} onClick={handleHeart}>
        <span>{hearted ? '❤️' : '🤍'}</span>
        <span className="drift-heart-count">{wish.hearts + (hearted ? 1 : 0)}</span>
      </button>
    </div>
  );
};

export { WishDrift };
export type { Props as WishDriftProps };

// 导出一个用于触发 shake 的工具函数
export function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export default WishDrift;
