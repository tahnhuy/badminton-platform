import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/common/brand-logo';
import { useAuth } from '@/features/auth/auth-context';
import { SessionLoading } from '@/features/auth/session-loading';
import { PlayerProfileLayout } from '@/features/player/components/PlayerProfileLayout';

/**
 * Public tournament pages (PRD §5 Visitor, Tech Design §12): a signed-in Player keeps the Player
 * shell; visitors and other roles get a light public shell with sign-in links.
 */
export function PublicTournamentLayout() {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <SessionLoading />;
  if (status === 'passwordChangeRequired') return <Navigate to="/change-password" replace />;
  if (user?.role === 'PLAYER') return <PlayerProfileLayout />;
  return <div className="flex min-h-svh flex-col bg-background font-sans text-foreground">
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-360 items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" aria-label="SmashPro — trang chủ" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"><BrandLogo size="sm" compactOnMobile /></Link>
        <nav aria-label="Giải đấu" className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" className="h-10 px-3"><Link to="/tournaments">Giải đấu</Link></Button>
          <Button asChild variant="ghost" className="hidden h-10 px-3 sm:inline-flex"><Link to="/tournaments/rankings">Bảng xếp hạng</Link></Button>
          {!user && <Button asChild className="h-10"><Link to="/sign-in" state={{ from: location }}><LogIn aria-hidden="true" />Đăng nhập</Link></Button>}
        </nav>
      </div>
    </header>
    <main id="main-content" className="flex-1 pt-6"><Outlet /></main>
  </div>;
}
