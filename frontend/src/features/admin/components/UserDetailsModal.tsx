import React from 'react';
import type { User, PlayerProfile, CourtOwnerProfile } from '../types/user';
import { CloseIcon } from '../../../components/common/Icons';
import { useModalA11y } from '../../../shared/hooks/useModalA11y';
import { formatDate } from '../../../shared/utils/formatDate';
import { UserRatingsPanels } from '../../ratings/components/UserRatingsPanels';

interface UserDetailsModalProps {
  user: User | null;
  onClose: () => void;
  onEditStatus: (user: User) => void;
  onResetPassword: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  user,
  onClose,
  onEditStatus,
  onResetPassword,
  onDeleteUser,
}) => {
  const dialogRef = useModalA11y<HTMLDivElement>(Boolean(user), onClose);

  if (!user) return null;

  const isPlayer = user.role === 'PLAYER';
  const isOwner = user.role === 'COURT_OWNER';
  const playerProfile = isPlayer ? (user.profile as PlayerProfile) : null;
  const ownerProfile = isOwner ? (user.profile as CourtOwnerProfile) : null;

  const displayName = playerProfile?.fullName || ownerProfile?.businessName || user.email;

  const statusColors =
    user.status === 'ACTIVE'
      ? { backgroundColor: 'var(--bg-tag-green)', color: 'var(--color-brand)' }
      : user.status === 'SUSPENDED'
        ? { backgroundColor: 'var(--bg-tag-red)', color: 'var(--color-danger)' }
        : { backgroundColor: 'var(--bg-table-header)', color: 'var(--text-secondary)' };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(19, 27, 46, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 80,
      padding: 16
    }}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="animate-fade-in"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          boxShadow: 'var(--shadow-modal)',
          maxWidth: 560,
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(189, 202, 186, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-table-header)'
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Chi tiết hồ sơ người dùng
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Mã định danh: #UID-{user.id + 10000}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 6,
              borderRadius: 8,
              color: 'var(--text-secondary)',
              backgroundColor: '#FFFFFF',
              display: 'flex'
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', maxHeight: '70vh' }}>
          {/* User Hero */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'var(--color-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontSize: 24,
              fontWeight: 700,
              boxShadow: 'var(--shadow-sm)'
            }}>
              {displayName.charAt(0).toUpperCase()}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {displayName}
                </span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  ...statusColors
                }}>
                  {user.status}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {user.email}
              </div>
            </div>
          </div>

          {/* Key Attributes Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            backgroundColor: 'var(--bg-table-header)',
            padding: 16,
            borderRadius: 12
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                VAI TRÒ
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                {user.role}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                NGÀY THAM GIA
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                {formatDate(user.createdAt)}
              </div>
            </div>

            {isPlayer && (
              <>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    TRÌNH ĐỘ
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                    Cấp {playerProfile?.skillLevelId || 1} (Trung bình)
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    ĐIỂM FAIRPLAY
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-brand)', marginTop: 2 }}>
                    98/100 (Hạng A)
                  </div>
                </div>
              </>
            )}

            {isOwner && (
              <>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    SỐ ĐIỆN THOẠI
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                    {ownerProfile?.phone || 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    QUY MÔ SÂN
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-brand)', marginTop: 2 }}>
                    10 Sân tiêu chuẩn
                  </div>
                </div>
              </>
            )}
          </div>

          {isPlayer && <UserRatingsPanels userId={user.id} />}
        </div>

        {/* Modal Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(189, 202, 186, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#FCFBFF'
        }}>
          {user.role !== 'ADMIN' ? (
            <button
              onClick={() => {
                onClose();
                onDeleteUser(user);
              }}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-danger)',
                padding: '8px 12px'
              }}
            >
              Xóa tài khoản
            </button>
          ) : <div />}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => {
                onClose();
                onResetPassword(user);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-tag-uid)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 600
              }}
            >
              Đặt lại mật khẩu
            </button>

            <button
              onClick={() => {
                onClose();
                onEditStatus(user);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                backgroundColor: 'var(--color-brand)',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              Đổi trạng thái
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
