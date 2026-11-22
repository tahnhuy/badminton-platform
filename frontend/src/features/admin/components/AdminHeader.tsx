import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkipLink } from '@/components/common/skip-link';
import { cn } from '@/shared/utils/cn';
import { adminGlobalSearchService } from '../services/adminGlobalSearchService';
import type { GlobalSearchResult } from '../services/adminGlobalSearchService';
import { GlobalSearchResults } from './GlobalSearchResults';
import { AdminAccountMenu } from './AdminAccountMenu';
import { NotificationsMenu } from '../../notifications/components/NotificationsMenu';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface AdminHeaderProps {
  isCollapsed?: boolean;
  onToggleMobileSidebar?: () => void;
  breadcrumbs?: BreadcrumbItem[];
}

const ROUTE_BREADCRUMBS_MAP: Record<string, BreadcrumbItem[]> = {
  '/admin/dashboard': [
    { label: 'Trung tâm Quản trị' },
    { label: 'Bảng điều khiển' },
  ],
  '/admin/users': [
    { label: 'Trung tâm Quản trị' },
    { label: 'Quản trị người dùng' },
  ],
  '/admin/courts': [
    { label: 'Trung tâm Quản trị' },
    { label: 'Quản lý cơ sở & sân' },
  ],
  '/admin/approvals': [
    { label: 'Trung tâm Quản trị' },
    { label: 'Duyệt cơ sở & sân' },
  ],
  '/admin/tournaments': [
    { label: 'Trung tâm Quản trị' },
    { label: 'Quản lý giải đấu' },
  ],
  '/admin/reports': [
    { label: 'Trung tâm Quản trị' },
    { label: 'Quản lý báo cáo & khiếu nại' },
  ],
  '/admin/finance': [
    { label: 'Trung tâm Quản trị' },
    { label: 'Quản lý tài chính' },
  ],
  '/admin/configs': [
    { label: 'Trung tâm Quản trị' },
    { label: 'Cấu hình hệ thống' },
  ],
  '/admin/notifications': [
    { label: 'Trung tâm Quản trị' },
    { label: 'Thông báo' },
  ],
};

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  isCollapsed = false,
  onToggleMobileSidebar,
  breadcrumbs,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Global search state
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [results, setResults] = useState<GlobalSearchResult>({
    users: [],
    facilities: [],
    tournaments: [],
    reports: [],
  });

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Auto focus mobile input when opened
  useEffect(() => {
    if (isMobileSearchOpen && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

  // Determine breadcrumbs from props or from current route path
  const activeBreadcrumbs: BreadcrumbItem[] =
    breadcrumbs ||
    ROUTE_BREADCRUMBS_MAP[location.pathname] ||
    (location.pathname.startsWith('/admin/finance/') ? [
      ...ROUTE_BREADCRUMBS_MAP['/admin/finance'],
      { label: ({ overview: 'Tổng quan', transactions: 'Giao dịch', wallets: 'Ví', 'top-ups': 'Nạp tiền', payouts: 'Chi trả', refunds: 'Hoàn tiền', 'owner-earnings': 'Thu nhập chủ sân', reconciliation: 'Đối soát', reports: 'Báo cáo', audit: 'Nhật ký thao tác' } as Record<string, string>)[location.pathname.split('/')[3]] || 'Chi tiết' },
    ] : location.pathname.startsWith('/admin/notifications/') ? [...ROUTE_BREADCRUMBS_MAP['/admin/notifications'], { label: 'Chi tiết' }]
      : /^\/admin\/courts\/[^/]+\/reviews$/.test(location.pathname) ? [...ROUTE_BREADCRUMBS_MAP['/admin/courts'], { label: 'Xét duyệt hồ sơ' }] : null) || [
      { label: 'Trung tâm Quản trị' },
      { label: 'Quản trị hệ thống' },
    ];

  // Debounced Global Search API call
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults({ users: [], facilities: [], tournaments: [], reports: [] });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await adminGlobalSearchService.search(trimmed);
        setResults(data);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const handleSelectResult = (path: string) => {
    setIsOpen(false);
    setIsMobileSearchOpen(false);
    navigate(path);
  };


  return <><SkipLink targetId="admin-main-content" /><header className={cn('fixed inset-x-0 top-0 z-40 flex h-18 min-w-0 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 shadow-sm backdrop-blur transition-[left] duration-200 motion-reduce:transition-none sm:px-6', isCollapsed ? 'lg:left-17' : 'lg:left-60')}>
    {isMobileSearchOpen ? <div className="relative flex w-full min-w-0 items-center gap-3">
      <div className="relative min-w-0 flex-1"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input ref={mobileInputRef} className="h-11 rounded-lg pl-9 pr-11 text-sm motion-safe:focus-visible:translate-y-0" type="text" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm kiếm toàn sàn (User, Sân, Giải...)" />{query && <Button type="button" size="icon" variant="ghost" className="absolute right-0 top-0" aria-label="Xóa từ khóa" onClick={() => setQuery('')}><X aria-hidden="true" /></Button>}</div>
      <Button type="button" variant="outline" className="h-11" onClick={() => { setIsMobileSearchOpen(false); setQuery(''); }}>Đóng</Button>
      {query.trim().length > 0 && <div className="absolute inset-x-0 top-full z-[100] mt-2 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-card py-2 shadow-xl"><GlobalSearchResults isLoading={isLoading} results={results} query={query} onSelectResult={handleSelectResult} /></div>}
    </div> : <>
      <div className="flex min-w-0 flex-1 items-center gap-2"><Button type="button" size="icon" variant="ghost" className="lg:hidden" onClick={onToggleMobileSidebar} aria-label="Mở thanh điều hướng"><Menu aria-hidden="true" /></Button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 overflow-hidden text-xs sm:text-sm">{activeBreadcrumbs.map((crumb, index) => <React.Fragment key={index}>{index > 0 && <span className="shrink-0 text-muted-foreground">&gt;</span>}<span title={crumb.label} className={cn('truncate', index === activeBreadcrumbs.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{crumb.label}</span></React.Fragment>)}</nav>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div ref={searchContainerRef} className="relative hidden min-[769px]:block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 w-64 rounded-lg pl-9 pr-11 text-sm motion-safe:focus-visible:translate-y-0 xl:w-80" type="text" value={query} onFocus={() => setIsOpen(true)} onChange={event => { setQuery(event.target.value); setIsOpen(true); }} placeholder="Tìm kiếm toàn sàn (User, Sân, Giải...)" />
          {query && <Button type="button" size="icon" variant="ghost" className="absolute right-0 top-0" aria-label="Xóa tìm kiếm" onClick={() => { setQuery(''); setResults({ users: [], facilities: [], tournaments: [], reports: [] }); }}><X aria-hidden="true" /></Button>}
          {isOpen && query.trim().length > 0 && <div className="absolute right-0 top-full z-[100] mt-2 max-h-[60vh] w-96 overflow-y-auto rounded-lg border border-border bg-card py-2 shadow-xl"><GlobalSearchResults isLoading={isLoading} results={results} query={query} onSelectResult={handleSelectResult} /></div>}
        </div>
        <Button type="button" variant="outline" size="icon" className="min-[769px]:hidden" onClick={() => setIsMobileSearchOpen(true)} aria-label="Mở tìm kiếm"><Search aria-hidden="true" /></Button>
        <div className="flex shrink-0 items-center gap-1 border-l border-border pl-1"><NotificationsMenu basePath="/admin/notifications" /><AdminAccountMenu /></div>
      </div>
    </>}
  </header></>;
};
