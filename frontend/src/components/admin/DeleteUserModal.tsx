import React, { useState } from 'react';
import type { User } from '../../types/user';
import { CloseIcon, TrashIcon } from '../common/Icons';
import { useModalA11y } from '../../hooks/useModalA11y';

interface DeleteUserModalProps {
  user: User | null;
  onClose: () => void;
  onConfirm: (userId: number) => Promise<void>;
}

export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  user,
  onClose,
  onConfirm,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalA11y<HTMLDivElement>(Boolean(user), onClose);

  if (!user) return null;

  const isAdmin = user.role === 'ADMIN';

  const handleDelete = async () => {
    if (isAdmin) {
      setError('Quy tắc hệ thống: Không thể xóa tài khoản Quản trị viên (Admin).');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(user.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa tài khoản');
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
          maxWidth: 440,
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
          backgroundColor: 'var(--bg-tag-red)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrashIcon size={18} color="var(--color-danger)" />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-danger)' }}>
              Xác nhận xóa tài khoản
            </span>
          </div>
          <button onClick={onClose} style={{ padding: 4, display: 'flex' }}>
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            Bạn có chắc chắn muốn xóa tài khoản <strong>{user.email}</strong> (#UID-{user.id + 10000}) không?
          </div>

          <div style={{
            padding: 12,
            backgroundColor: 'var(--bg-table-header)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--text-secondary)'
          }}>
            Tài khoản sẽ được chuyển sang trạng thái <strong>Soft Delete</strong> để bảo toàn tính toàn vẹn dữ liệu lịch sử đặt sân và giải đấu.
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
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting || isAdmin}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                backgroundColor: 'var(--color-danger)',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                boxShadow: 'var(--shadow-sm)',
                opacity: isAdmin ? 0.5 : 1
              }}
            >
              {isSubmitting ? 'Đang xóa...' : 'Xóa tài khoản'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
