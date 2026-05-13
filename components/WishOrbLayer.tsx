import React, { useState } from 'react';
import { WishOrb } from '../types';

interface WishOrbLayerProps {
  orbs: WishOrb[];
}

const WishOrbLayer: React.FC<WishOrbLayerProps> = ({ orbs }) => {
  const [selected, setSelected] = useState<WishOrb | null>(null);

  return (
    <>
      {orbs.map((orb, i) => (
        <div
          key={orb.id}
          className="wish-orb"
          style={{
            left: `${orb.x * 100}%`,
            top: `${orb.y * 100}%`,
            animationDelay: `${(i % 7) * 0.4}s`,
          }}
          onClick={e => { e.stopPropagation(); setSelected(orb); }}
        />
      ))}

      {selected && (
        <div className="wish-detail-overlay" onClick={() => setSelected(null)}>
          <div className="wish-detail-sheet" onClick={e => e.stopPropagation()}>
            <button className="wish-detail-close" onClick={() => setSelected(null)}>×</button>
            <div className="wish-detail-orb-icon" />
            <div className="wish-detail-label">· 你挂在这里的愿望 ·</div>
            <p className="wish-detail-wish">「{selected.wish}」</p>
            <div className="wish-detail-divider" />
            <p className="wish-detail-light">{selected.lightMessage}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default WishOrbLayer;
