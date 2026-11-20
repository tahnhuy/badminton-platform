import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Building2, CircleUserRound, Flag, LayoutDashboard, Menu, Search, Trophy, Users, X } from 'lucide-react';
import { BrandLogo } from '@/components/common/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/shared/utils/cn';
import { useAuth } from '@/features/auth/use-auth';

interface AdminSidebarProps {
  isMobileOpen?: boolean; onMobileClose?: () => void; isCollapsed?: boolean; onToggleCollapse?: () => void;
}
export function AdminSidebar({ isMobileOpen = false, onMobileClose, isCollapsed = false, onToggleCollapse }: AdminSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const navItems = [
    { path: '/admin/dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
    { path: '/admin/users', label: 'Quản lý người dùng', icon: Users },
    { path: '/admin/courts', label: 'Quản lý cơ sở & sân', icon: Building2 },
    { path: '/admin/tournaments', label: 'Quản lý giải đấu', icon: Trophy },
    { path: '/admin/reports', label: 'Quản lý báo cáo', icon: Flag },
  ];
  const filteredNavItems = navItems.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase().trim()));
  const handleNavClick = () => { if (onMobileClose) onMobileClose(); };
  return <>
    {isMobileOpen && onMobileClose && <div className="fixed inset-0 z-55 bg-foreground/40 backdrop-blur-sm lg:hidden" onClick={onMobileClose} aria-label="Đóng thanh điều hướng" />}
    <aside aria-label="Thanh điều hướng quản trị" className={cn('fixed inset-y-0 left-0 z-60 flex w-65 flex-col justify-between border-r border-border bg-card text-foreground transition-[width,transform] duration-200 motion-reduce:transition-none lg:translate-x-0', isMobileOpen ? 'visible translate-x-0 shadow-xl' : 'invisible -translate-x-full lg:visible', isCollapsed ? 'lg:w-17' : 'lg:w-60')}>
      <div className="min-h-0 overflow-y-auto">
        <div className={cn('flex min-h-18 items-center border-b border-border', isCollapsed ? 'flex-col gap-3 py-4' : 'justify-between gap-2 px-4')}>
          <div title="SmashPro ADMIN"><BrandLogo size="sm" className={isCollapsed ? '[&>span:last-child]:sr-only' : 'text-lg'} /></div>
          <Button type="button" size="icon" variant="ghost" onClick={onToggleCollapse} aria-label={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'} title={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'} className="hidden lg:inline-flex"><Menu aria-hidden="true" /></Button>
          {!isCollapsed && <Button type="button" size="icon" variant="ghost" onClick={onMobileClose} aria-label="Đóng thanh điều hướng" className="lg:hidden"><X aria-hidden="true" /></Button>}
        </div>
        {!isCollapsed && <div className="relative m-3"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 rounded-lg pl-9 pr-11 text-sm motion-safe:focus-visible:translate-y-0" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Tìm nhanh tab chức năng..." />{searchQuery && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" aria-label="Xóa tìm kiếm" onClick={() => setSearchQuery('')}><X aria-hidden="true" /></Button>}</div>}
        <nav aria-label="Điều hướng quản trị" className={cn('flex flex-col gap-1 p-2', isCollapsed && 'items-center')}>
          {!isCollapsed && filteredNavItems.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">Không tìm thấy menu</p>}
          {filteredNavItems.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} title={label} aria-label={label} onClick={handleNavClick} className={({ isActive }) => cn('flex min-h-11 items-center gap-3 rounded-lg text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring', isCollapsed ? 'size-11 justify-center' : 'px-3 py-3', isActive ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><Icon aria-hidden="true" className="size-5 shrink-0" />{!isCollapsed && <span>{label}</span>}</NavLink>)}
        </nav>
      </div>
      <div className={cn('flex items-center gap-3 border-t border-border p-4', isCollapsed && 'justify-center px-2')} title={user?.email}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><CircleUserRound aria-hidden="true" className="size-5" /></span>
        {!isCollapsed && <div className="min-w-0"><p className="text-xs font-bold">Quản trị viên</p><p className="truncate text-xs text-muted-foreground">{user?.email}</p></div>}
      </div>
    </aside>
  </>;
}
