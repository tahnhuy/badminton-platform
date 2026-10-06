import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ShuttlecockIcon, CloseIcon } from '../../../components/common/Icons';
import { useAuth } from '../../auth/use-auth';
import { useModalA11y } from '../../../shared/hooks/useModalA11y';
import { PLAYER_NAV_TABS } from '../nav-tabs';

interface PlayerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlayerSidebar: React.FC<PlayerSidebarProps> = ({ isOpen, onClose }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const dialogRef = useModalA11y<HTMLElement>(isOpen, onClose);

  const displayName = user?.email ? user.email.split('@')[0] : 'Người chơi';
  const initial = displayName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    try {
      await signOut();
      onClose();
      navigate('/sign-in');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="player-sidebar-overlay"
          onClick={onClose}
          aria-label="Đóng thanh điều hướng"
        />
      )}

      <aside
        ref={dialogRef}
        className={`player-sidebar${isOpen ? ' open' : ''}`}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
          <div
            style={{
              height: 68,
              padding: '0 14px 0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(189, 202, 186, 0.3)',
              flexShrink: 0,
            }}
          >
            <Link to="/" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
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
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
                  SmashPro
                </div>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--color-brand)' }}>
                  PLAYER PORTAL
                </div>
              </div>
            </Link>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng thanh điều hướng"
              title="Đóng"
              style={{
                width: 32,
                height: 32,
                borderRadius: 7,
                display: 'flex',
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

          <nav style={{ padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {PLAYER_NAV_TABS.map((tab) => (
              <NavLink
                key={tab.key}
                to={tab.path}
                end={tab.path === '/'}
                onClick={onClose}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  padding: '9px 12px',
                  borderRadius: 8,
                  backgroundColor: isActive ? '#EAF5EC' : 'transparent',
                  color: isActive ? 'var(--color-brand)' : 'var(--text-secondary)',
                  fontSize: 13.5,
                  fontWeight: isActive ? 700 : 500,
                  textDecoration: 'none',
                  borderLeft: isActive ? '3px solid var(--color-brand)' : '3px solid transparent',
                  transition: 'all 0.15s ease',
                })}
              >
                {tab.label}
              </NavLink>
            ))}

            <div style={{ height: 1, backgroundColor: 'rgba(189, 202, 186, 0.3)', margin: '8px 4px' }} />

            <Link to="/bookings" onClick={onClose} style={secondaryLinkStyle}>
              Lịch đặt sân của tôi
            </Link>
            <Link to="/change-password" onClick={onClose} style={secondaryLinkStyle}>
              Đổi mật khẩu
            </Link>
          </nav>
        </div>

        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(189, 202, 186, 0.3)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '8px',
              borderRadius: 10,
              backgroundColor: 'var(--bg-subtle)',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                backgroundColor: 'var(--color-brand)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '9px 12px',
              borderRadius: 8,
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
};

const secondaryLinkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '9px 12px',
  borderRadius: 8,
  color: 'var(--text-secondary)',
  fontSize: 13.5,
  fontWeight: 500,
  textDecoration: 'none',
};
