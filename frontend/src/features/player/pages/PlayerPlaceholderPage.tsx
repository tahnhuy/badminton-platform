import React from 'react';

interface PlayerPlaceholderPageProps {
  title: string;
  description?: string;
}

export const PlayerPlaceholderPage: React.FC<PlayerPlaceholderPageProps> = ({
  title,
  description,
}) => {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        minHeight: 'calc(100vh - 180px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 580,
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: '40px 32px',
          border: '1px solid rgba(189, 202, 186, 0.4)',
          boxShadow: 'var(--shadow-sm, 0px 1px 2px 0px rgba(0, 0, 0, 0.05))',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 9999,
            backgroundColor: 'rgba(0, 107, 44, 0.1)',
            marginBottom: 16,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'var(--color-brand, #006B2C)',
            }}
          />
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-brand, #006B2C)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Player Portal
          </span>
        </div>

        <h1
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: 24,
            lineHeight: '32px',
            color: 'var(--text-primary, #131B2E)',
            margin: '0 0 8px',
          }}
        >
          {title}
        </h1>

        {description && (
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 14,
              lineHeight: '20px',
              color: 'var(--text-secondary, #505F76)',
              margin: 0,
            }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
};
