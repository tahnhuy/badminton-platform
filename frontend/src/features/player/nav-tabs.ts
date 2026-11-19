import { CalendarCheck, MessageCircle, Star, Swords, UsersRound, type LucideIcon } from 'lucide-react';

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

/** SH01 (2026-11-18): only areas with working pages; Home and Tournaments return when they exist. */
export const PLAYER_NAV_TABS: PlayerNavTab[] = [
  { key: 'courts', label: 'Sân cầu lông', shortLabel: 'Sân', path: '/courts', icon: CalendarCheck },
  { key: 'matchmaking', label: 'Tìm đối thủ', shortLabel: 'Đối thủ', path: '/matchmaking', icon: Swords },
  { key: 'social', label: 'Cộng đồng', shortLabel: 'Cộng đồng', path: '/feed', icon: UsersRound },
  { key: 'messages', label: 'Tin nhắn', shortLabel: 'Tin nhắn', path: '/messages', icon: MessageCircle },
  { key: 'ratings', label: 'Đánh giá', shortLabel: 'Đánh giá', path: '/ratings/given', icon: Star },
];
