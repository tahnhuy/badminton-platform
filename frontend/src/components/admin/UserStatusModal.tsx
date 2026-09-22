import React, { useState } from 'react';
import type { User, UserStatus } from '../../types/user';
import { CloseIcon } from '../common/Icons';
import { useModalA11y } from '../../hooks/useModalA11y';

interface UserStatusModalProps {
  user: User | null;
  onClose: () => void;
  onConfirm: (userId: number, newStatus: UserStatus) => Promise<void>;
}

export const UserStatusModal: React.FC<UserStatusModalProps> = ({
  user,
  onClose,
  onConfirm,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<UserStatus>(user?.status ?? 'ACTIVE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalA11y<HTMLDivElement>(Boolean(user), onClose);

  React.useEffect(() => {
    if (user) {
      setSelectedStatus(user.status);
      setError(null);
    }
  }, [user]);

  if (!user) return null;

  const isAdmin = user.role === 'ADMIN';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdmin && (selectedStatus === 'SUSPENDED' || selectedStatus === 'DEACTIVATED')) {
      setError('Quy tắc hệ thống: Không thể đình chỉ hoặc vô hiệu hóa tài khoản Quản trị viên (Admin).');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(user.id, selectedStatus);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật trạng thái');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          maxWidth: 480,
          width: '100%',
          overflow: 'hidden',
          outline: 'none'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(189, 202, 186, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-table-header)'
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Thay đổi trạng thái tài khoản
          </div>
          <button onClick={onClose} style={{ padding: 4, display: 'flex' }}>
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Cập nhật trạng thái hoạt động cho tài khoản <strong>{user.email}</strong>.
          </div>

          {error && (
            <div style={{
              padding: 12,
              borderRadius: 8,
              backgroundColor: 'var(--bg-tag-red)',
              color: 'var(--color-danger)',
              fontSize: 12,
              fontWeight: 600
            }}>
              {error}
            </div>
          )}

          {/* Status Radios */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* ACTIVE */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: 12,
              borderRadius: 8,
              border: `1.5px solid ${selectedStatus === 'ACTIVE' ? 'var(--color-brand)' : 'rgba(189, 202, 186, 0.4)'}`,
              backgroundColor: selectedStatus === 'ACTIVE' ? 'rgba(0, 107, 44, 0.04)' : '#FFFFFF',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                name="status"
                value="ACTIVE"
                checked={selectedStatus === 'ACTIVE'}
                onChange={() => setSelectedStatus('ACTIVE')}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-brand)' }}>
                  ACTIVE (Hoạt động)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Tài khoản được phép đăng nhập và sử dụng đầy đủ tính năng nền tảng.
                </div>
              </div>
            </label>

            {/* SUSPENDED */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: 12,
              borderRadius: 8,
              border: `1.5px solid ${selectedStatus === 'SUSPENDED' ? 'var(--color-danger)' : 'rgba(189, 202, 186, 0.4)'}`,
              backgroundColor: selectedStatus === 'SUSPENDED' ? 'rgba(255, 218, 214, 0.15)' : '#FFFFFF',
              cursor: isAdmin ? 'not-allowed' : 'pointer',
              opacity: isAdmin ? 0.5 : 1
            }}>
              <input
                type="radio"
                name="status"
                value="SUSPENDED"
                checked={selectedStatus === 'SUSPENDED'}
                onChange={() => setSelectedStatus('SUSPENDED')}
                disabled={isAdmin}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-danger)' }}>
                  SUSPENDED (Tạm đình chỉ)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Tài khoản bị tạm khóa do vi phạm điều lệ giải đấu hoặc quy tắc cộng đồng.
                </div>
              </div>
            </label>

            {/* DEACTIVATED */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: 12,
              borderRadius: 8,
              border: `1.5px solid ${selectedStatus === 'DEACTIVATED' ? 'var(--text-secondary)' : 'rgba(189, 202, 186, 0.4)'}`,
              backgroundColor: selectedStatus === 'DEACTIVATED' ? 'var(--bg-table-header)' : '#FFFFFF',
              cursor: isAdmin ? 'not-allowed' : 'pointer',
              opacity: isAdmin ? 0.5 : 1
            }}>
              <input
                type="radio"
                name="status"
                value="DEACTIVATED"
                checked={selectedStatus === 'DEACTIVATED'}
                onChange={() => setSelectedStatus('DEACTIVATED')}
                disabled={isAdmin}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  DEACTIVATED (Vô hiệu hóa)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Vô hiệu hóa vĩnh viễn quyền truy cập của người dùng trên toàn hệ thống.
                </div>
              </div>
            </label>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-table-header)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 600
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                backgroundColor: 'var(--color-brand)',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
