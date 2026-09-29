interface StateBlockProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function StateBlock({ title, description, actionLabel, onAction }: StateBlockProps) {
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
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          style={{
            height: 220,
            borderRadius: 14,
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-table-header)',
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}
