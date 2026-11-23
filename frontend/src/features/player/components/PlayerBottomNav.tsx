import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import { PLAYER_NAV_TABS, isPlayerTabActive } from '../nav-tabs';
import { UnreadBadge } from './UnreadBadge';

/** Mobile/tablet primary navigation (< 1024 px), fixed to the bottom for one-handed use. */
export function PlayerBottomNav({ unreadMessages }: { unreadMessages: number }) {
  const { pathname } = useLocation();
  return <nav data-app-bottom-nav aria-label="Điều hướng chính"
    className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
    <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
      {PLAYER_NAV_TABS.map(tab => {
        const { key, shortLabel, path, icon: Icon } = tab;
        const active = isPlayerTabActive(pathname, tab);
        return <li key={key} className="flex">
          <Link to={path} aria-current={active ? 'page' : undefined}
            className={cn('relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              active ? 'text-primary' : 'text-muted-foreground')}>
            <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-accent')}>
              <Icon aria-hidden="true" className="size-5" />
            </span>
            {shortLabel}
            {key === 'messages' && <UnreadBadge count={unreadMessages} className="absolute left-1/2 top-1 ml-2 min-w-4 px-1 text-2xs leading-4" />}
          </Link>
        </li>;
      })}
    </ul>
  </nav>;
}
