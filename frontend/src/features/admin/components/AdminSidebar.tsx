import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShuttlecockIcon,
  DashboardIcon,
  UsersIcon,
  CourtIcon,
  TournamentIcon,
  ReportIcon,
  MenuIcon,
  CloseIcon,
  SearchIcon,
  KeyIcon,
} from '../../../components/common/Icons';

interface AdminSidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  isMobileOpen = false,
  onMobileClose,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const navItems = [
    {
      path: '/admin/dashboard',
      label: 'Bảng điều khiển',
      icon: (active: boolean) => <DashboardIcon size={18} color={active ? 'var(--color-brand)' : '#505F76'} />,
    },
    {
      path: '/admin/users',
      label: 'Quản lý người dùng',
      icon: (active: boolean) => <UsersIcon size={18} color={active ? 'var(--color-brand)' : '#505F76'} />,
    },
    {
      path: '/admin/courts',
      label: 'Quản lý cơ sở & sân',
      icon: (active: boolean) => <CourtIcon size={18} color={active ? 'var(--color-brand)' : '#505F76'} />,
    },
    {
      path: '/admin/tournaments',
      label: 'Quản lý giải đấu',
      icon: (active: boolean) => <TournamentIcon size={18} color={active ? 'var(--color-brand)' : '#505F76'} />,
    },
    {
      path: '/admin/reports',
      label: 'Quản lý báo cáo',
      badge: '4',
      icon: (active: boolean) => <ReportIcon size={18} color={active ? 'var(--color-brand)' : '#505F76'} />,
    },
    {
      path: '/admin/configs',
      label: 'Cấu hình hệ thống',
      icon: (active: boolean) => <KeyIcon size={18} color={active ? 'var(--color-brand)' : '#505F76'} />,
    },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleNavClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && onMobileClose && (
        <div
          className="admin-sidebar-overlay"
          onClick={onMobileClose}
          aria-label="Đóng thanh điều hướng"
        />
      )}

      <aside
        className={`admin-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
      >
        {isCollapsed ? (
          /* ================= COLLAPSED / MINI SIDEBAR (DESKTOP) ================= */
          <div className="admin-sidebar-mini-view">
            <div>
              {/* Logo & 3-gạch button placed underneath logo */}
              <div
                style={{
                  padding: '14px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  borderBottom: '1px solid rgba(189, 202, 186, 0.3)',
                }}
              >
                {/* Logo Icon */}
                <div
                  title="SmashPro ADMIN"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: 'var(--color-brand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <ShuttlecockIcon size={18} color="#FFFFFF" />
                </div>

                {/* 3-gạch Hamburger Button under logo */}
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label="Mở rộng thanh điều hướng"
                  title="Mở rộng thanh điều hướng"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid rgba(189, 202, 186, 0.4)',
                    cursor: 'pointer',
                  }}
                >
                  <MenuIcon size={17} color="var(--text-primary)" />
                </button>
              </div>

              {/* Navigation Menu Tabs (Icons only) */}
              <nav style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                {filteredNavItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={item.label}
                    onClick={handleNavClick}
                    style={({ isActive }) => ({
                      width: 40,
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      backgroundColor: isActive ? '#EAF5EC' : 'transparent',
                      color: isActive ? 'var(--color-brand)' : 'var(--text-secondary)',
                      textDecoration: 'none',
                      position: 'relative',
                      border: isActive ? '1px solid rgba(0, 107, 44, 0.25)' : '1px solid transparent',
                      boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.15s ease',
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        {item.icon(isActive)}
                        {item.badge && (
                          <span
                            style={{
                              position: 'absolute',
                              top: 5,
                              right: 5,
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-danger)',
                            }}
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>

            {/* Mini Profile Avatar */}
            <div
              style={{
                padding: '12px 0',
                borderTop: '1px solid rgba(189, 202, 186, 0.3)',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div
                title="System Admin (admin@smashpro.vn)"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9999,
                  backgroundColor: 'var(--color-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                SA
              </div>
            </div>
          </div>
        ) : (
          /* ================= EXPANDED SIDEBAR / MOBILE DRAWER ================= */
          <div className="admin-sidebar-full-view">
            <div>
              {/* Brand Header */}
              <div
                style={{
                  height: 68,
                  padding: '0 14px 0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(189, 202, 186, 0.3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  {/* Green Icon Logo */}
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      backgroundColor: 'var(--color-brand)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <ShuttlecockIcon size={18} color="#FFFFFF" />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          letterSpacing: '-0.025em',
                        }}
                      >
                        SmashPro
                      </span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '1.5px 5px',
                          borderRadius: 4,
                          backgroundColor: 'var(--bg-tag-blue)',
                          color: 'var(--text-primary)',
                          letterSpacing: '0.04em',
                        }}
                      >
                        ADMIN
                      </span>
                    </div>
                  </div>
                </div>

                {/* Desktop Collapse Button (Hamburger) */}
                <button
                  type="button"
                  className="admin-sidebar-desktop-toggle"
                  onClick={onToggleCollapse}
                  aria-label="Thu gọn thanh điều hướng"
                  title="Thu gọn thanh điều hướng"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 7,
                    color: 'var(--text-primary)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid rgba(189, 202, 186, 0.4)',
                    cursor: 'pointer',
                  }}
                >
                  <MenuIcon size={16} color="var(--text-primary)" />
                </button>

                {/* Mobile Close Button (X icon) - Shown only on Mobile Drawer */}
                <button
                  type="button"
                  className="admin-sidebar-mobile-close"
                  onClick={onMobileClose}
                  aria-label="Đóng thanh điều hướng"
                  title="Đóng thanh điều hướng"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 7,
                    color: 'var(--text-primary)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid rgba(189, 202, 186, 0.4)',
                    cursor: 'pointer',
                  }}
                >
                  <CloseIcon size={16} color="var(--text-primary)" />
                </button>
              </div>

              {/* Quick Search Menu Tabs */}
              <div style={{ padding: '10px 10px 4px' }}>
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      pointerEvents: 'none',
                    }}
                  >
                    <SearchIcon size={13} color="var(--text-secondary)" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm nhanh tab chức năng..."
                    style={{
                      width: '100%',
                      height: 32,
                      paddingLeft: 28,
                      paddingRight: searchQuery ? 24 : 10,
                      borderRadius: 6,
                      backgroundColor: 'var(--bg-table-header)',
                      border: '1px solid rgba(189, 202, 186, 0.4)',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Xóa tìm kiếm"
                      style={{
                        position: 'absolute',
                        right: 6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-secondary)',
                        fontSize: 11,
                        padding: 2,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        background: 'transparent',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Navigation Menu */}
              <nav style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {filteredNavItems.length === 0 ? (
                  <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                    Không tìm thấy menu
                  </div>
                ) : (
                  filteredNavItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={handleNavClick}
                      style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 8,
                        backgroundColor: isActive ? '#EAF5EC' : 'transparent',
                        color: isActive ? 'var(--color-brand)' : 'var(--text-secondary)',
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 500,
                        textDecoration: 'none',
                        borderLeft: isActive ? '3px solid var(--color-brand)' : '3px solid transparent',
                        boxShadow: isActive ? '0px 1px 3px rgba(0, 107, 44, 0.06)' : 'none',
                        transition: 'all 0.15s ease',
                      })}
                    >
                      {({ isActive }) => (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {item.icon(isActive)}
                            <span>{item.label}</span>
                          </div>
                          {item.badge && (
                            <span
                              style={{
                                backgroundColor: 'var(--color-danger)',
                                color: '#FFFFFF',
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 9999,
                              }}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))
                )}
              </nav>
            </div>

            {/* Bottom Profile Section */}
            <div
              style={{
                padding: '12px 14px',
                borderTop: '1px solid rgba(189, 202, 186, 0.3)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9999,
                      backgroundColor: 'var(--color-brand)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    SA
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                      System Admin
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                      admin@smashpro.vn
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
