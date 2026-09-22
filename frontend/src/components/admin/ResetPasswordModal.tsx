import React, { useState } from 'react';
import type { User } from '../../types/user';
import { CloseIcon, KeyIcon } from '../common/Icons';
import { useModalA11y } from '../../hooks/useModalA11y';

interface ResetPasswordModalProps {
  user: User | null;
  onClose: () => void;
  onConfirm: (userId: number, newPassword: string) => Promise<void>;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  user,
  onClose,
  onConfirm,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalA11y<HTMLDivElement>(Boolean(user), onClose);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(user.id, password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đặt lại mật khẩu');
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
          backgroundColor: 'var(--bg-table-header)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyIcon size={18} color="var(--color-brand)" />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Đặt lại mật khẩu
            </span>
          </div>
          <button onClick={onClose} style={{ padding: 4, display: 'flex' }}>
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Thiết lập mật khẩu trực tiếp cho tài khoản <strong>{user.email}</strong>.
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

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Mật khẩu mới
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập tối thiểu 6 ký tự..."
              style={{
                width: '100%',
                height: 40,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid rgba(189, 202, 186, 0.5)',
                fontSize: 14
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Xác nhận mật khẩu mới
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu..."
              style={{
                width: '100%',
                height: 40,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid rgba(189, 202, 186, 0.5)',
                fontSize: 14
              }}
              required
            />
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
              {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
