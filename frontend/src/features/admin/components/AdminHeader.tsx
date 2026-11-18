import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SearchIcon, BellIcon, MenuIcon } from '../../../components/common/Icons';
import { adminGlobalSearchService } from '../services/adminGlobalSearchService';
import type { GlobalSearchResult } from '../services/adminGlobalSearchService';
import { GlobalSearchResults } from './GlobalSearchResults';
import { AdminAccountMenu } from './AdminAccountMenu';

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
  '/admin/tournaments': [
    { label: 'Trung tâm Quản trị' },
    { label: 'Quản lý giải đấu' },
  ],
  '/admin/reports': [
    { label: 'Trung tâm Quản trị' },
    { label: 'Quản lý báo cáo & khiếu nại' },
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
    ROUTE_BREADCRUMBS_MAP[location.pathname] || [
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


  return (
    <header className={`admin-header ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ================= MOBILE ACTIVE SEARCH BAR ================= */}
      {isMobileSearchOpen ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', position: 'relative' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}>
              <SearchIcon size={16} color="var(--text-secondary)" />
            </div>
            <input
              ref={mobileInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm kiếm toàn sàn (User, Sân, Giải...)"
              style={{
                width: '100%',
                height: 38,
                paddingLeft: 34,
                paddingRight: query ? 30 : 12,
                borderRadius: 8,
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--color-brand)',
                fontSize: 13,
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Xóa từ khóa"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setIsMobileSearchOpen(false);
              setQuery('');
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid rgba(189, 202, 186, 0.4)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Đóng
          </button>

          {/* Mobile search results dropdown */}
          {query.trim().length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 8,
                maxHeight: '60vh',
                overflowY: 'auto',
                backgroundColor: '#FFFFFF',
                borderRadius: 10,
                boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
                border: '1px solid rgba(189, 202, 186, 0.45)',
                zIndex: 100,
                boxSizing: 'border-box',
              }}
            >
              <GlobalSearchResults isLoading={isLoading} results={results} query={query} onSelectResult={handleSelectResult} />
            </div>
          )}
        </div>
      ) : (
        /* ================= STANDARD HEADER VIEW ================= */
        <>
          {/* Left Path / Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            {/* 3-line Hamburger Menu Button for Mobile */}
            {onToggleMobileSidebar && (
              <button
                type="button"
                className="admin-header-mobile-toggle"
                onClick={onToggleMobileSidebar}
                aria-label="Mở thanh điều hướng"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-table-header)',
                  border: '1px solid rgba(189, 202, 186, 0.4)',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  flexShrink: 0,
                }}
              >
                <MenuIcon size={18} color="var(--text-primary)" />
              </button>
            )}

            {/* Breadcrumb Navigation on Header with ellipsis and responsive shrinking */}
            <nav aria-label="Breadcrumb" className="admin-header-breadcrumbs">
              {activeBreadcrumbs.map((crumb, index) => {
                const isLast = index === activeBreadcrumbs.length - 1;
                return (
                  <React.Fragment key={index}>
                    {index > 0 && (
                      <span className="breadcrumb-separator">&gt;</span>
                    )}
                    <span
                      className={`breadcrumb-item ${isLast ? 'active' : ''}`}
                      title={crumb.label}
                    >
                      {crumb.label}
                    </span>
                  </React.Fragment>
                );
              })}
            </nav>
          </div>

          {/* Right Search & Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Desktop Global Search Bar */}
            <div
              ref={searchContainerRef}
              className="admin-header-desktop-search"
              style={{ position: 'relative', width: 320 }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  pointerEvents: 'none',
                }}
              >
                <SearchIcon size={15} />
              </div>

              <input
                type="text"
                value={query}
                onFocus={() => setIsOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                }}
                placeholder="Tìm kiếm toàn sàn (User, Sân, Giải...)"
                style={{
                  width: '100%',
                  height: 36,
                  paddingLeft: 34,
                  paddingRight: query ? 28 : 12,
                  borderRadius: 8,
                  backgroundColor: 'var(--bg-subtle)',
                  border: isOpen ? '1px solid var(--color-brand)' : '1px solid rgba(189, 202, 186, 0.4)',
                  fontSize: 12.5,
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxShadow: isOpen ? '0 0 0 2px rgba(0, 107, 44, 0.1)' : 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease',
                }}
              />

              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setResults({ users: [], facilities: [], tournaments: [], reports: [] });
                  }}
                  aria-label="Xóa tìm kiếm"
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 2,
                  }}
                >
                  ✕
                </button>
              )}

              {/* Desktop Global Search Results Dropdown */}
              {isOpen && query.trim().length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    width: '100%',
                    marginTop: 6,
                    maxHeight: 440,
                    overflowY: 'auto',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 10,
                    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)',
                    border: '1px solid rgba(189, 202, 186, 0.45)',
                    zIndex: 100,
                    boxSizing: 'border-box',
                  }}
                >
                  <GlobalSearchResults isLoading={isLoading} results={results} query={query} onSelectResult={handleSelectResult} />
                </div>
              )}
            </div>

            {/* Mobile Search Icon Button */}
            <button
              type="button"
              className="admin-header-mobile-search-btn"
              onClick={() => setIsMobileSearchOpen(true)}
              aria-label="Mở tìm kiếm"
              title="Tìm kiếm toàn sàn"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-table-header)',
                border: '1px solid rgba(189, 202, 186, 0.4)',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <SearchIcon size={17} color="var(--text-primary)" />
            </button>

            {/* Notification button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              borderLeft: '1px solid rgba(189, 202, 186, 0.4)',
              paddingLeft: 10,
            }}>
              <button
                type="button"
                aria-label="Thông báo"
                title="Thông báo"
                style={{
                  position: 'relative',
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-tag-uid)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <BellIcon size={18} color="#3E4A3D" />
                <span style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-danger)',
                  boxShadow: '0px 0px 0px 2px #FFFFFF'
                }} />
              </button>
              <AdminAccountMenu />
            </div>
          </div>
        </>
      )}
    </header>
  );
};
