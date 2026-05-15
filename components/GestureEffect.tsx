import React, { useEffect, useState } from 'react';
import { AppMode } from '../types';

interface Props {
  mode: AppMode;
}

// ── 爱心雨 (LOVE) ────────────────────────────────────────────
const HeartRain: React.FC = () => {
  const hearts = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    left: `${5 + Math.random() * 90}%`,
    delay: `${Math.random() * 1.2}s`,
    duration: `${1.8 + Math.random() * 1.4}s`,
    size: `${0.9 + Math.random() * 0.8}rem`,
    rotate: `${-25 + Math.random() * 50}deg`,
  }));

  return (
    <div className="gesture-effect-layer">
      {hearts.map(h => (
        <div
          key={h.id}
          className="falling-heart"
          style={{ left: h.left, animationDelay: h.delay, animationDuration: h.duration, fontSize: h.size, '--rotate': h.rotate } as React.CSSProperties}
        >
          ♥
        </div>
      ))}
    </div>
  );
};

// ── 金色粒子爆发 (CAREER) ─────────────────────────────────────
const GoldBurst: React.FC = () => {
  const sparks = Array.from({ length: 28 }, (_, i) => {
    const angle = (i / 28) * 360 + Math.random() * 13;
    const dist  = 60 + Math.random() * 100;
    const tx = Math.cos(angle * Math.PI / 180) * dist;
    const ty = Math.sin(angle * Math.PI / 180) * dist;
    return { id: i, angle, tx, ty, delay: `${Math.random() * 0.3}s`, size: `${0.5 + Math.random() * 0.6}rem` };
  });

  return (
    <div className="gesture-effect-layer flex items-center justify-center">
      {sparks.map(s => (
        <div
          key={s.id}
          className="gold-spark"
          style={{
            '--tx': `${s.tx}px`,
            '--ty': `${s.ty}px`,
            animationDelay: s.delay,
            fontSize: s.size,
          } as React.CSSProperties}
        >
          ★
        </div>
      ))}
    </div>
  );
};

// ── 绿色波纹 (HEALTH) ─────────────────────────────────────────
const GreenWave: React.FC = () => (
  <div className="gesture-effect-layer flex items-center justify-center">
    {[0, 0.4, 0.8].map(delay => (
      <div
        key={delay}
        className="green-ring"
        style={{ animationDelay: `${delay}s` }}
      />
    ))}
  </div>
);

// ── 主组件 ────────────────────────────────────────────────────
const GestureEffect: React.FC<Props> = ({ mode }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (mode === AppMode.TREE) { setVisible(false); return; }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, [mode]);

  if (!visible || mode === AppMode.TREE) return null;

  return (
    <>
      {mode === AppMode.LOVE   && <HeartRain />}
      {mode === AppMode.CAREER && <GoldBurst />}
      {mode === AppMode.HEALTH && <GreenWave />}
    </>
  );
};

export default GestureEffect;
