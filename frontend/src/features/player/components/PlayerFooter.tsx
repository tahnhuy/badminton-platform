import { SiteFooter } from '@/components/common/site-footer';
import { PLAYER_NAV_TABS } from '../nav-tabs';

const LINKS = [
  ...PLAYER_NAV_TABS.map(tab => ({ to: tab.path, label: tab.label })),
  { to: '/bookings', label: 'Lịch đặt sân của tôi' },
];

/** Player shell footer built on the shared footer; links reuse the nav-tab source. */
export function PlayerFooter() {
  return <SiteFooter
    homePath="/feed"
    tagline="Cộng đồng cầu lông — tìm sân, ghép trận và kết nối người chơi."
    links={LINKS}
    linksLabel="Liên kết chân trang người chơi"
    roleLabel="Kênh người chơi"
  />;
}
