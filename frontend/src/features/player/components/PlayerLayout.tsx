import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { SkipLink } from '@/components/common/skip-link';
import { GlobalChatDock } from '../../messaging/components/GlobalChatDock';
import { useUnreadMessages } from '../../messaging/hooks/use-unread-messages';
import { PlayerBottomNav } from './PlayerBottomNav';
import { PlayerFooter } from './PlayerFooter';
import { PlayerHeader } from './PlayerHeader';

/** Player shell (SH01): header, main content, minimal footer, mobile bottom navigation and the chat dock. */
export function PlayerLayout({ children }: { children?: ReactNode }) {
  const unreadMessages = useUnreadMessages();
  return <div className="flex min-h-svh flex-col bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] font-sans text-foreground lg:pb-0">
    <SkipLink />
    <PlayerHeader unreadMessages={unreadMessages} />
    <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">{children ?? <Outlet />}</main>
    <PlayerFooter />
    <PlayerBottomNav unreadMessages={unreadMessages} />
    <GlobalChatDock />
  </div>;
}
