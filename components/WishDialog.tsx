import React, { useEffect, useRef, useState } from 'react';

interface WishDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (wish: string) => void;
}

const WishDialog: React.FC<WishDialogProps> = ({ open, onClose, onSubmit }) => {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText('');
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    const wish = text.trim();
    if (!wish) return;
    onSubmit(wish);
    setText('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  return (
    <div className="wish-dialog-overlay" onClick={onClose}>
      <div className="wish-dialog-card" onClick={e => e.stopPropagation()}>
        <button className="wish-dialog-cancel" onClick={onClose}>×</button>
        <div className="wish-dialog-title">把一个愿望，挂在这棵树上</div>
        <div className="wish-dialog-sub">· 随风漂流，传递给有缘人 ·</div>
        <textarea
          ref={inputRef}
          className="wish-dialog-input"
          placeholder="比如：希望我能勇敢一点"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          maxLength={60}
          rows={3}
        />
        <div style={{ textAlign: 'right', fontSize: '0.65rem', color: 'rgba(255,255,255,0.22)', marginTop: 4 }}>
          {text.length}/60
        </div>
        <button className="wish-dialog-btn" disabled={!text.trim()} onClick={handleSubmit}>
          ✦ 挂上树枝
        </button>
      </div>
    </div>
  );
};

export default WishDialog;
