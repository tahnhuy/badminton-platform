import React from 'react';

interface FooterLink {
  label: string;
  href: string;
}

const FOOTER_LINKS: FooterLink[] = [
  { label: 'Điều khoản sử dụng', href: '#' },
  { label: 'Chính sách bảo mật', href: '#' },
  { label: 'Quy định đặt sân', href: '#' },
  { label: 'Hỗ trợ cộng đồng', href: '#' },
];

export const PlayerFooter: React.FC = () => {
  return (
    <footer
      style={{
        width: '100%',
        backgroundColor: 'var(--bg-card, #FFFFFF)',
        borderTop: '1px solid rgba(189, 202, 186, 0.4)',
        marginTop: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: 1440,
          margin: '0 auto',
          padding: '24px 32px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
        }}
      >
        {/* Left: Brand summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 260 }}>
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              fontSize: 16,
              lineHeight: '24px',
              color: 'var(--text-primary, #131B2E)',
            }}
          >
            SmashPro Badminton Ecosystem
          </span>
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: 13,
              lineHeight: '18px',
              color: 'var(--text-secondary, #505F76)',
              maxWidth: 480,
            }}
          >
            Nền tảng kết nối người chơi cầu lông, đặt sân trực tuyến và giải đấu chuyên nghiệp.
          </span>
        </div>

        {/* Center: Quick navigation links */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px 24px',
          }}
        >
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => {
                if (link.href === '#') e.preventDefault();
              }}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 12,
                lineHeight: '16px',
                letterSpacing: '0.02em',
                color: 'var(--text-tag-uid, #3E4A3D)',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-brand, #006B2C)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-tag-uid, #3E4A3D)';
              }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Right: Copyright */}
        <div style={{ flexShrink: 0 }}>
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: 13,
              lineHeight: '18px',
              color: 'var(--text-secondary, #505F76)',
            }}
          >
            © 2024 SmashPro Inc. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
};
