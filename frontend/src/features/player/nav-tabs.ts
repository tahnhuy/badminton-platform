export interface PlayerNavTab {
  key: string;
  label: string;
  path: string;
}

export function isPlayerTabActive(pathname: string, tab: PlayerNavTab) {
  if (tab.key === 'social' && pathname.startsWith('/posts/')) return true;
  return tab.path === '/' ? pathname === '/' : pathname === tab.path || pathname.startsWith(`${tab.path}/`);
}

export const PLAYER_NAV_TABS: PlayerNavTab[] = [
  { key: 'home', label: 'Trang chủ', path: '/' },
  { key: 'courts', label: 'Sân cầu lông', path: '/courts' },
  { key: 'matchmaking', label: 'Tìm đối thủ', path: '/matchmaking' },
  { key: 'ratings', label: 'Đánh giá', path: '/ratings/given' },
  { key: 'tournaments', label: 'Giải đấu', path: '/tournaments' },
  { key: 'social', label: 'Cộng đồng', path: '/feed' },
];
