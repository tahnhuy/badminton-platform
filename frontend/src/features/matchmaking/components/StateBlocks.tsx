import { useEffect, useState } from 'react';
import { statusLabel } from '../utils/status';

export function StateBlock({ title, description, actionLabel, onAction }: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 10,
        padding: '48px 24px',
        backgroundColor: 'var(--bg-card)',
        border: '1px dashed var(--border-medium)',
        borderRadius: 14,
      }}
    >
      <h3 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)', maxWidth: 480 }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: 8,
            padding: '10px 18px',
            borderRadius: 8,
            backgroundColor: 'var(--color-brand)',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = new Date(expiresAt).getTime() - now;
  if (remaining <= 0) {
    return <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Đã hết hạn</span>;
  }
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
      Còn {minutes}:{String(seconds).padStart(2, '0')}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const palette: Record<string, { bg: string; color: string }> = {
    PENDING_COURT: { bg: 'var(--bg-tag-amber)', color: 'var(--color-warning)' },
    CONFIRMED: { bg: 'var(--bg-tag-green)', color: 'var(--color-brand)' },
    IN_PROGRESS: { bg: 'var(--bg-tag-owner)', color: 'var(--text-primary)' },
    COMPLETED: { bg: 'var(--bg-tag-green)', color: 'var(--color-brand)' },
    OPEN: { bg: 'rgba(0, 107, 44, 0.1)', color: 'var(--color-brand)' },
    PENDING: { bg: 'rgba(67, 102, 0, 0.12)', color: 'var(--color-warning)' },
    MATCHED: { bg: 'rgba(0, 80, 220, 0.1)', color: '#0050DC' },
    ACCEPTED: { bg: 'rgba(0, 107, 44, 0.1)', color: 'var(--color-brand)' },
    DECLINED: { bg: 'rgba(186, 26, 26, 0.1)', color: 'var(--color-danger)' },
    CANCELLED: { bg: 'rgba(186, 26, 26, 0.1)', color: 'var(--color-danger)' },
    EXPIRED: { bg: 'rgba(80, 95, 118, 0.12)', color: 'var(--text-secondary)' },
    WITHDRAWN: { bg: 'rgba(80, 95, 118, 0.12)', color: 'var(--text-secondary)' },
  };
  const style = palette[status] ?? { bg: 'var(--bg-table-header)', color: 'var(--text-secondary)' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 700,
        backgroundColor: style.bg,
        color: style.color,
      }}
    >
      {statusLabel(status)}
    </span>
  );
}
