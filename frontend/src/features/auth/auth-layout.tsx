import type { ReactNode } from 'react';
import { ShuttlecockIcon, UsersIcon, CourtIcon, TournamentIcon } from '../../components/common/Icons';

const BRAND_FEATURES = [
  {
    icon: UsersIcon,
    title: 'Ghép trận thông minh',
    description: 'Tìm đối thủ và đồng đội cùng trình độ, cùng khu vực.',
  },
  {
    icon: CourtIcon,
    title: 'Đặt sân theo thời gian thực',
    description: 'Xem slot trống và giữ sân ngay, không chờ chủ sân duyệt.',
  },
  {
    icon: TournamentIcon,
    title: 'Giải đấu phong trào',
    description: 'Đăng ký, theo dõi bracket và kết quả thi đấu.',
  },
];

function BrandLogo() {
  return (
    <>
      <div className="auth-brand-logo-mark">
        <ShuttlecockIcon size={22} />
      </div>
      <div>
        <span className="auth-brand-logo-name">SmashPro</span>
        <span className="auth-brand-logo-tag">Badminton Ecosystem</span>
      </div>
    </>
  );
}

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Two-column shell shared by the public auth screens: brand panel on the left,
 * form card on the right. Collapses to a single column on narrow screens.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand-panel">
        <div className="auth-brand-logo">
          <BrandLogo />
        </div>

        <div>
          <p className="auth-brand-headline">Kết nối cộng đồng cầu lông của bạn</p>
          <p className="auth-brand-sub">
            Tìm bạn chơi, đặt sân và tham gia giải đấu — tất cả trên một nền tảng.
          </p>
          <ul className="auth-brand-features">
            {BRAND_FEATURES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="auth-brand-feature">
                <span className="auth-brand-feature-icon">
                  <Icon size={18} color="#FFFFFF" />
                </span>
                <span>
                  <span className="auth-brand-feature-title">{title}</span>
                  <span className="auth-brand-feature-desc">{description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-brand-footer">© 2026 SmashPro Badminton Ecosystem</p>
      </aside>

      <main className="auth-main">
        <div className="auth-mobile-logo">
          <BrandLogo />
        </div>
        {children}
      </main>
    </div>
  );
}

type AlertVariant = 'error' | 'warning' | 'success' | 'info';

function AlertIcon({ variant }: { variant: AlertVariant }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (variant === 'success') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="8 12 11 15 16 9" />
      </svg>
    );
  }

  if (variant === 'warning') {
    return (
      <svg {...common}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

interface AuthAlertProps {
  variant: AlertVariant;
  role?: 'alert' | 'status';
  children: ReactNode;
}

export function AuthAlert({ variant, role, children }: AuthAlertProps) {
  return (
    <div role={role} className={`auth-alert auth-alert-${variant}`}>
      <AlertIcon variant={variant} />
      <div>{children}</div>
    </div>
  );
}
