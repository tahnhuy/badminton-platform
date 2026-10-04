import React, { useState, useEffect } from 'react';
import type { User, PlayerProfile, CourtOwnerProfile } from '../types/user';
import { DataTable } from '../../../components/common/DataTable';
import type { ColumnDef } from '../../../components/common/DataTable';
import { MoreVerticalIcon, KeyIcon, TrashIcon } from '../../../components/common/Icons';
import { formatDate } from '../../../shared/utils/formatDate';

interface ActiveMenuState {
  user: User;
  top: number;
  left: number;
}

interface UserTableProps {
  users: User[];
  isLoading: boolean;
  selectedIds: number[];
  onSelectToggle: (id: number) => void;
  onSelectAllToggle: () => void;
  onViewDetails: (user: User) => void;
  onChangeStatus: (user: User) => void;
  onResetPassword: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  isLoading,
  selectedIds,
  onSelectToggle,
  onSelectAllToggle,
  onViewDetails,
  onChangeStatus,
  onResetPassword,
  onDeleteUser,
}) => {
  const [activeMenu, setActiveMenu] = useState<ActiveMenuState | null>(null);

  // Close menu on outside scroll or resize
  useEffect(() => {
    const handleClose = () => setActiveMenu(null);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, []);

  const getDisplayName = (user: User) => {
    if (user.role === 'PLAYER' && user.profile && 'fullName' in user.profile) {
      return (user.profile as PlayerProfile).fullName;
    }
    if (user.role === 'COURT_OWNER' && user.profile && 'businessName' in user.profile) {
      return (user.profile as CourtOwnerProfile).businessName;
    }
    return user.email.split('@')[0];
  };

  const getSubBadge = (user: User) => {
    if (user.role === 'COURT_OWNER' && user.profile && 'businessName' in user.profile) {
      return (user.profile as CourtOwnerProfile).businessName;
    }
    return null;
  };

  const getAvatarUrl = (user: User, index: number): string => {
    if (user.role === 'PLAYER' && user.profile && 'avatarUrl' in user.profile && (user.profile as PlayerProfile).avatarUrl) {
      return (user.profile as PlayerProfile).avatarUrl || '/images/avatar_player1-56586a.png';
    }
    const fallbackAvatars = [
      '/images/avatar_player1-56586a.png',
      '/images/avatar_owner1-56586a.png',
      '/images/avatar_player2-4a0be7.png',
      '/images/avatar_owner2-6064bd.png',
      '/images/avatar_player3-7ca715.png',
    ];
    return fallbackAvatars[index % fallbackAvatars.length];
  };

  const columns: ColumnDef<User>[] = [
    {
      key: 'userInfo',
      header: 'NGƯỜI DÙNG / ĐỊNH DANH',
      minWidth: 320,
      render: (user, index) => {
        const isSuspended = user.status === 'SUSPENDED';
        const isDeactivated = user.status === 'DEACTIVATED' || user.deletedAt !== null;
        const subBadge = getSubBadge(user);

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Avatar */}
            <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
              <img
                src={getAvatarUrl(user, index)}
                alt={getDisplayName(user)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  backgroundColor: isSuspended ? 'var(--color-danger)' : isDeactivated ? '#767676' : 'var(--color-brand)',
                  boxShadow: '0 0 0 2px #FFFFFF',
                }}
              />
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {getDisplayName(user)}
                </span>
                {subBadge && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 4,
                      backgroundColor: '#D0E1FB',
                      color: '#54647A',
                    }}
                  >
                    {subBadge}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                <span>{user.email}</span>
                <span>•</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: 4,
                    backgroundColor: 'var(--bg-tag-uid)',
                    color: 'var(--text-tag-uid)',
                  }}
                >
                  #UID-{user.id + 10000}
                </span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'role',
      header: 'VAI TRÒ HỆ THỐNG',
      minWidth: 145,
      render: (user) => {
        if (user.role === 'PLAYER') {
          return (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 9999,
                backgroundColor: 'var(--bg-tag-green)',
                color: 'var(--color-brand)',
                fontSize: 11.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              <span>VĐV (Player)</span>
            </div>
          );
        }
        if (user.role === 'COURT_OWNER') {
          return (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 9999,
                backgroundColor: 'var(--bg-tag-owner)',
                color: 'var(--color-owner-badge)',
                fontSize: 11.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              <span>Chủ sân (Owner)</span>
            </div>
          );
        }
        return (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 8px',
              borderRadius: 9999,
              backgroundColor: 'var(--bg-tag-blue)',
              color: 'var(--text-primary)',
              fontSize: 11.5,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            <span>Quản trị viên (Admin)</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'TRẠNG THÁI',
      minWidth: 140,
      render: (user) => {
        if (user.status === 'ACTIVE') {
          return (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 9999,
                backgroundColor: 'var(--bg-tag-green)',
                color: 'var(--color-brand)',
                fontSize: 11,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--color-brand)' }} />
              <span>ACTIVE</span>
            </div>
          );
        }
        if (user.status === 'SUSPENDED') {
          return (
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  backgroundColor: 'var(--bg-tag-red)',
                  color: 'var(--color-danger)',
                  fontSize: 11,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--color-danger)' }} />
                <span>SUSPENDED</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--color-danger)', marginTop: 2 }}>
                Đình chỉ (Vi phạm)
              </div>
            </div>
          );
        }
        return (
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 9999,
                backgroundColor: 'var(--bg-table-header)',
                color: 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              <span>DEACTIVATED</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Đã vô hiệu hóa
            </div>
          </div>
        );
      },
    },
    {
      key: 'fairplay',
      header: 'CHỈ SỐ FAIRPLAY / QUY MÔ',
      minWidth: 175,
      render: (user) => {
        const isSuspended = user.status === 'SUSPENDED';
        if (user.role === 'COURT_OWNER') {
          return (
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>10 Sân tiêu chuẩn</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                Cơ sở Q.10 • Đã kiểm duyệt
              </div>
            </div>
          );
        }
        return (
          <div style={{ width: 140 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>
              <span style={{ color: isSuspended ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                {isSuspended ? 'Cảnh báo FairPlay' : 'Điểm FairPlay'}
              </span>
              <span style={{ color: isSuspended ? 'var(--color-danger)' : 'var(--color-brand)' }}>
                {isSuspended ? '65/100' : '98/100'}
              </span>
            </div>
            <div
              style={{
                height: 4,
                width: '100%',
                backgroundColor: 'var(--bg-table-header)',
                borderRadius: 9999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: isSuspended ? '65%' : '98%',
                  backgroundColor: isSuspended ? 'var(--color-danger)' : 'var(--color-brand)',
                  borderRadius: 9999,
                }}
              />
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 3 }}>
              {isSuspended ? 'Bỏ trận 02 lần' : '42 trận • 0 thẻ phạt'}
            </div>
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'NGÀY GIA NHẬP',
      minWidth: 110,
      render: (user) => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {formatDate(user.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'THAO TÁC',
      headerClassName: 'text-right',
      className: 'text-right',
      minWidth: 135,
      render: (user) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <button
            type="button"
            onClick={() => onViewDetails(user)}
            style={{
              padding: '5px 10px',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            Xem chi tiết
          </button>

          {/* 3-dots Menu Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (activeMenu?.user.id === user.id) {
                setActiveMenu(null);
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              const menuHeight = 165;
              const spaceBelow = window.innerHeight - rect.bottom;
              const showAbove = spaceBelow < menuHeight && rect.top > menuHeight;

              setActiveMenu({
                user,
                top: showAbove ? rect.top - menuHeight - 4 : rect.bottom + 4,
                left: rect.right - 180,
              });
            }}
            style={{
              padding: '5px',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeMenu?.user.id === user.id ? 'var(--bg-subtle)' : 'transparent',
            }}
          >
            <MoreVerticalIcon size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable<User>
        data={users}
        columns={columns}
        keyExtractor={(u) => u.id}
        isLoading={isLoading}
        selectable
        selectedIds={selectedIds}
        onSelectAll={onSelectAllToggle}
        onSelectItem={(id) => onSelectToggle(Number(id))}
        emptyState={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'var(--bg-table-header)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              👥
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Không tìm thấy người dùng
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 360 }}>
              Không có tài khoản nào phù hợp với bộ lọc hoặc từ khóa tìm kiếm của bạn.
            </div>
          </div>
        }
      />

      {activeMenu && (
        <>
          <div
            onClick={() => setActiveMenu(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          />
          <div
            style={{
              position: 'fixed',
              top: activeMenu.top,
              left: Math.max(8, activeMenu.left),
              width: 180,
              backgroundColor: '#FFFFFF',
              borderRadius: 8,
              boxShadow: 'var(--shadow-modal)',
              border: '1px solid rgba(189, 202, 186, 0.4)',
              padding: '4px 0',
              zIndex: 9999,
              textAlign: 'left',
            }}
          >
            <button
              type="button"
              onClick={() => {
                const u = activeMenu.user;
                setActiveMenu(null);
                onViewDetails(u);
              }}
              style={{
                width: '100%',
                padding: '7px 14px',
                fontSize: 12.5,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>Xem chi tiết</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const u = activeMenu.user;
                setActiveMenu(null);
                onChangeStatus(u);
              }}
              style={{
                width: '100%',
                padding: '7px 14px',
                fontSize: 12.5,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>Đổi trạng thái</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const u = activeMenu.user;
                setActiveMenu(null);
                onResetPassword(u);
              }}
              style={{
                width: '100%',
                padding: '7px 14px',
                fontSize: 12.5,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <KeyIcon size={13} />
              <span>Đặt lại mật khẩu</span>
            </button>

            <div style={{ height: 1, backgroundColor: 'rgba(189, 202, 186, 0.3)', margin: '4px 0' }} />

            <button
              type="button"
              onClick={() => {
                const u = activeMenu.user;
                setActiveMenu(null);
                onDeleteUser(u);
              }}
              style={{
                width: '100%',
                padding: '7px 14px',
                fontSize: 12.5,
                color: 'var(--color-danger)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <TrashIcon size={13} color="var(--color-danger)" />
              <span>Xóa tài khoản</span>
            </button>
          </div>
        </>
      )}
    </>
  );
};
