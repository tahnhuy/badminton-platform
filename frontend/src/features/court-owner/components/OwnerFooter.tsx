import { SiteFooter } from '@/components/common/site-footer';
import { OWNER_NAV_LINKS } from './owner-nav-links';

/** Owner shell footer built on the shared footer; links keep the selected facility query. */
export function OwnerFooter({ query }: { query: string }) {
  return <SiteFooter
    homePath={`/owner${query}`}
    tagline="Kênh quản lý cơ sở cầu lông — theo dõi lịch đặt, bảng giá và thu nhập."
    links={OWNER_NAV_LINKS.map(link => ({ to: `/owner${link.path}${query}`, label: link.label }))}
    linksLabel="Liên kết chân trang chủ sân"
    roleLabel="Kênh chủ sân"
  />;
}
