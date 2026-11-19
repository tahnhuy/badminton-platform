
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
