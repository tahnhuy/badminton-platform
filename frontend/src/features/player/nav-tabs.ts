export interface PlayerNavTab {
  key: string;
  label: string;
  path: string;
}

export const PLAYER_NAV_TABS: PlayerNavTab[] = [
  { key: 'home', label: 'Trang chủ', path: '/' },
  { key: 'courts', label: 'Sân cầu lông', path: '/courts' },
  { key: 'matchmaking', label: 'Tìm đối thủ', path: '/matchmaking' },
  { key: 'tournaments', label: 'Giải đấu', path: '/tournaments' },
];
