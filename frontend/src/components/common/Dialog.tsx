import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModalA11y } from '../../shared/hooks/useModalA11y';
import './community-primitives.css';

export function Dialog({ title, children, onClose, busy = false, wide = false }: {
  title: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean;
}) {
  const [trigger] = useState(() => document.activeElement as HTMLElement | null);
  const ref = useModalA11y<HTMLDivElement>(true, () => { if (!busy) onClose(); });
  useEffect(() => {
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, [trigger]);
  return createPortal(<div className="community-dialog-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div className={`community-dialog${wide ? ' community-dialog-wide' : ''}`} ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <header><h2>{title}</h2><button type="button" aria-label="Đóng hộp thoại" disabled={busy} onClick={onClose}>×</button></header>
      {children}
    </div>
  </div>, document.body);
}
