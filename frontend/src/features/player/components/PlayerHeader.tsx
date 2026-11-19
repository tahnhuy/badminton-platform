import { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Ban, CalendarDays, KeyRound, UserRound } from 'lucide-react';
import { BrandLogo } from '@/components/common/brand-logo';
import { AccountMenu } from '@/features/auth/account-menu';
import { getRoleHomePath } from '@/app/role-home';
import { cn } from '@/shared/utils/cn';
import { ProfileContext } from '../profile/profile-context';
import { PLAYER_NAV_TABS, isPlayerTabActive } from '../nav-tabs';
import { UnreadBadge } from './UnreadBadge';

const ACCOUNT_LINKS = [
  { to: '/profile', label: 'Hồ sơ cá nhân', icon: UserRound },
  { to: '/bookings', label: 'Lịch đặt sân của tôi', icon: CalendarDays },
  { to: '/settings/blocks', label: 'Danh sách chặn', icon: Ban },
  { to: '/change-password', label: 'Đổi mật khẩu', icon: KeyRound },
];

/** Player shell header: brand, primary navigation (≥ 1024 px) and the account menu. */
export function PlayerHeader({ unreadMessages }: { unreadMessages: number }) {
  const { pathname } = useLocation();
  const profile = useContext(ProfileContext)?.profile;
  const name = profile?.fullName ?? 'Người chơi';
  return <header data-app-header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
    <div className="mx-auto flex h-16 max-w-360 items-center gap-4 px-4 sm:px-6">
      <Link to={getRoleHomePath('PLAYER')} aria-label="SmashPro — về trang đầu" className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <BrandLogo size="sm" compactOnMobile />
      </Link>
      <nav aria-label="Điều hướng chính" className="hidden flex-1 items-center gap-1 lg:flex">
        {PLAYER_NAV_TABS.map(tab => {
          const active = isPlayerTabActive(pathname, tab);
          return <Link key={tab.key} to={tab.path} aria-current={active ? 'page' : undefined}
            className={cn('inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-accent font-semibold text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
            {tab.label}{tab.key === 'messages' && <UnreadBadge count={unreadMessages} />}
          </Link>;
        })}
      </nav>
      <div className="ml-auto">
        <AccountMenu triggerLabel="Tài khoản của tôi" name={name} detail={profile?.skillLevel?.name ? `Người chơi · ${profile.skillLevel.name}` : 'Người chơi'}
          avatarUrl={profile?.avatarUrl} links={ACCOUNT_LINKS} showName />
      </div>
    </div>
  </header>;
}
