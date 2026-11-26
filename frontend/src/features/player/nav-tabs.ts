import { CalendarCheck, MessageCircle, Swords, Trophy, UsersRound, type LucideIcon } from 'lucide-react';

export interface PlayerNavTab {
  key: string;
  label: string;
  /** Label of the mobile bottom tab. */
  shortLabel: string;
  path: string;
  icon: LucideIcon;
}

export function isPlayerTabActive(pathname: string, tab: PlayerNavTab) {
  if (tab.key === 'social' && pathname.startsWith('/posts/')) return true;
  if (tab.key === 'courts' && pathname.startsWith('/facilities/')) return true;
  return pathname === tab.path || pathname.startsWith(`${tab.path}/`);
}

/** SH01 (2026-11-18): only areas with working pages. TRN-07 (2026-11-25): Tournaments replaces Ratings, which moved to the account menu. */
export const PLAYER_NAV_TABS: PlayerNavTab[] = [
  { key: 'social', label: 'Cộng đồng', shortLabel: 'Cộng đồng', path: '/feed', icon: UsersRound },
  { key: 'matchmaking', label: 'Tìm đối thủ', shortLabel: 'Đối thủ', path: '/matchmaking', icon: Swords },
  { key: 'courts', label: 'Sân cầu lông', shortLabel: 'Sân', path: '/courts', icon: CalendarCheck },
  { key: 'messages', label: 'Tin nhắn', shortLabel: 'Tin nhắn', path: '/messages', icon: MessageCircle },
  { key: 'tournaments', label: 'Giải đấu', shortLabel: 'Giải đấu', path: '/tournaments', icon: Trophy },
];
