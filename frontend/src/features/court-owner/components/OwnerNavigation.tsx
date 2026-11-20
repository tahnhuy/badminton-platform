import { NavLink } from 'react-router-dom';
import { Building2, CalendarDays, CircleDollarSign, CircleUserRound, LayoutDashboard } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const links = [
  { path: '', label: 'Bảng điều khiển', short: 'Tổng quan', icon: LayoutDashboard },
  { path: '/facilities', label: 'Quản lý cơ sở', short: 'Cơ sở', icon: Building2 },
  { path: '/pricing', label: 'Bảng giá sân', short: 'Giá sân', icon: CircleDollarSign },
  { path: '/schedule', label: 'Lịch đặt & Giám sát', short: 'Lịch đặt', icon: CalendarDays },
  { path: '/account', label: 'Tài khoản', short: 'Tài khoản', icon: CircleUserRound },
];

export function OwnerNavigation({ query, mobile = false }: { query: string; mobile?: boolean }) {
  return <nav aria-label="Kênh Chủ sân" className={mobile ? 'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden' : 'order-last hidden w-full lg:block xl:order-none xl:w-auto'}>
    <ul className={mobile ? 'mx-auto grid h-16 max-w-xl grid-cols-5' : 'flex flex-wrap items-center gap-1 xl:flex-nowrap'}>{links.map(({ path, label, short, icon: Icon }) => <li key={path} className="flex min-w-0"><NavLink end to={`/owner${path}${query}`} aria-label={label} className={({ isActive }) => cn(
      'flex min-h-11 flex-1 items-center justify-center rounded-lg font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      mobile ? 'flex-col gap-1 py-2 text-xs' : 'gap-2 px-3 py-2 text-sm', isActive ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    )}><Icon aria-hidden="true" className={mobile ? 'size-5' : 'size-4'} /><span>{mobile ? short : label}</span></NavLink></li>)}</ul>
  </nav>;
}
