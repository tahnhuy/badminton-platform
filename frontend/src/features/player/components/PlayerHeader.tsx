import React, { useState, useRef, useEffect, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShuttlecockIcon, BellIcon, MenuIcon } from '../../../components/common/Icons';
import { useAuth } from '../../auth/use-auth';
import { PlayerSidebar } from './PlayerSidebar';
import { ProfileContext } from '../profile/profile-context';
import { ProfileAsset } from '../profile/ProfileAssets';
import '../profile/profile.css';
import { PLAYER_NAV_TABS, isPlayerTabActive } from '../nav-tabs';

export const PlayerHeader: React.FC = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/sign-in');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const profile = useContext(ProfileContext)?.profile;
  const displayName = profile?.fullName ?? 'Người chơi';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        width: '100%',
        backgroundColor: 'var(--bg-card, #FFFFFF)',
        borderBottom: '1px solid rgba(189, 202, 186, 0.4)',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
      }}
    >
      <div
        className="player-header-inner"
        style={{
          maxWidth: 1440,
          margin: '0 auto',
          height: 72,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left Side: Hamburger (mobile) + Brand Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button
            type="button"
            className="player-mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Mở thanh điều hướng"
            title="Menu"
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-table-header, #F2F3FF)',
              color: 'var(--text-primary, #131B2E)',
              border: '1px solid rgba(189, 202, 186, 0.4)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <MenuIcon size={18} />
          </button>

          <Link
            to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              backgroundColor: 'var(--color-brand, #006B2C)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: 'var(--shadow-sm, 0px 1px 2px 0px rgba(0,0,0,0.05))',
              flexShrink: 0,
            }}
          >
            <ShuttlecockIcon size={22} color="#FFFFFF" />
          </div>
          <div className="player-brand-text" style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 20,
                lineHeight: '24px',
                letterSpacing: '-0.025em',
                color: 'var(--text-primary, #131B2E)',
              }}
            >
              SmashPro
            </span>
            <span
              className="player-brand-subtitle"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 11,
                lineHeight: '14px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-brand, #006B2C)',
              }}
            >
              PLAYER PORTAL
            </span>
          </div>
        </Link>
        </div>

        {/* Center: Navigation Tabs (Desktop) */}
        <nav
          className="player-desktop-nav"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: 4,
          }}
        >
          {PLAYER_NAV_TABS.map((tab) => {
            const isActive = isPlayerTabActive(location.pathname, tab);

            return (
              <Link
                key={tab.key}
                to={tab.path}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: '20px',
                  letterSpacing: '0.01em',
                  textDecoration: 'none',
                  color: isActive ? 'var(--color-brand, #006B2C)' : 'var(--text-tag-uid, #3E4A3D)',
                  backgroundColor: isActive ? 'rgba(0, 107, 44, 0.08)' : 'transparent',
                  transition: 'all 0.15s ease-in-out',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-table-header, #F2F3FF)';
                    e.currentTarget.style.color = 'var(--text-primary, #131B2E)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-tag-uid, #3E4A3D)';
                  }
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Side: Notifications & User Profile */}
        <div
          className="player-header-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* Notification Button */}
          <button
            type="button"
            aria-label="Thông báo"
            title="Thông báo hệ thống"
            style={{
              position: 'relative',
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-table-header, #F2F3FF)',
              color: 'var(--text-secondary, #505F76)',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tag-uid, #EAEDFF)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-table-header, #F2F3FF)';
            }}
          >
            <BellIcon size={18} color="var(--text-secondary, #505F76)" />
            {/* Unread badge dot */}
            <span
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'var(--color-danger, #BA1A1A)',
                boxShadow: '0 0 0 2px #FFFFFF',
              }}
            />
          </button>

          <Link to="/profile" className="player-profile-shortcut" aria-label="Hồ sơ của tôi" title="Hồ sơ cá nhân"
            aria-current={location.pathname === '/profile' ? 'page' : undefined}><ProfileAsset name="identity" /></Link>

          {/* User Profile Pill & Dropdown */}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="player-profile-pill"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 14px 4px 4px',
                borderRadius: 9999,
                backgroundColor: 'var(--bg-subtle, #F2F3FF)',
                border: '1px solid rgba(189, 202, 186, 0.5)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-brand, #006B2C)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(189, 202, 186, 0.5)';
              }}
            >
              {/* Avatar circle */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-brand, #006B2C)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: 'var(--shadow-sm, 0px 1px 2px 0px rgba(0,0,0,0.05))',
                }}
              >
                {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} /> : initial}
              </div>

              {/* User text details */}
              <div
                className="player-profile-text"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: 12,
                    lineHeight: '16px',
                    color: 'var(--text-primary, #131B2E)',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayName}
                </span>
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: 11,
                    lineHeight: '12px',
                    color: 'var(--color-warning, #436600)',
                  }}
                >
                  {profile?.skillLevel.name ?? 'Người chơi'}
                </span>
              </div>
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 8,
                  width: 220,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  boxShadow: 'var(--shadow-lg, 0px 10px 15px -3px rgba(0, 0, 0, 0.08))',
                  border: '1px solid rgba(189, 202, 186, 0.45)',
                  padding: '6px 0',
                  zIndex: 100,
                }}
              >
                <div
                  style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid rgba(189, 202, 186, 0.3)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #131B2E)' }}>
                    {user?.email}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #505F76)', marginTop: 2 }}>
                    Vai trò: Người chơi (Player)
                  </div>
                </div>

                <Link to="/profile" onClick={() => setIsUserMenuOpen(false)}
                  style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none' }}>
                  Hồ sơ cá nhân
                </Link>
                <Link
                  to="/bookings"
                  onClick={() => setIsUserMenuOpen(false)}
                  style={{
                    display: 'block',
                    padding: '10px 16px',
                    fontSize: 13,
                    color: 'var(--text-primary, #131B2E)',
                    textDecoration: 'none',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-table-header, #F2F3FF)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Lịch đặt sân của tôi
                </Link>

                <Link
                  to="/change-password"
                  onClick={() => setIsUserMenuOpen(false)}
                  style={{
                    display: 'block',
                    padding: '10px 16px',
                    fontSize: 13,
                    color: 'var(--text-primary, #131B2E)',
                    textDecoration: 'none',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-table-header, #F2F3FF)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Đổi mật khẩu
                </Link>

                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--color-danger, #BA1A1A)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-danger-bg, rgba(255, 218, 214, 0.4))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <PlayerSidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </header>
  );
};
