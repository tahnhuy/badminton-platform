import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './use-auth';
import { getRoleHomePath } from '../../app/role-home';
import { ApiError } from '../../shared/api/http-client';

export function ChangePasswordPage() {
  const { user, status, changePassword, signOut } = useAuth();
  const navigate = useNavigate();

  const isForced = status === 'passwordChangeRequired' || user?.requiresPasswordChange;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFieldErrors({});

    try {
      const updatedUser = await changePassword({
        currentPassword,
        newPassword,
      });

      setSuccessMessage('Đổi mật khẩu thành công! Đang chuyển hướng...');
      setTimeout(() => {
        navigate(getRoleHomePath(updatedUser.role), { replace: true });
      }, 1000);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case 'AUTH_CURRENT_PASSWORD_INCORRECT':
            setErrorMessage('Mật khẩu hiện tại không đúng.');
            setFieldErrors({ currentPassword: 'Mật khẩu hiện tại không đúng' });
            break;

          case 'AUTH_PASSWORD_POLICY_VIOLATION':
            setErrorMessage(
              'Mật khẩu mới không thỏa mãn yêu cầu bảo mật: phải có từ 8 đến 64 ký tự và không được trùng với địa chỉ email.'
            );
            setFieldErrors({ newPassword: 'Mật khẩu phải từ 8-64 ký tự và không trùng email' });
            break;

          case 'AUTH_RATE_LIMITED':
            setErrorMessage('Quá nhiều yêu cầu đổi mật khẩu. Vui lòng thử lại sau ít phút.');
            break;

          case 'VALIDATION_FAILED': {
            const errors: Record<string, string> = {};
            for (const detail of err.details) {
              if (detail.field) {
                errors[detail.field] = 'Dữ liệu không hợp lệ';
              }
            }
            setFieldErrors(errors);
            setErrorMessage('Vui lòng kiểm tra lại thông tin đã nhập.');
            break;
          }

          default:
            setErrorMessage(err.message || 'Đã xảy ra lỗi khi đổi mật khẩu.');
            break;
        }
      } else {
        setErrorMessage('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'rgba(30, 41, 59, 0.85)',
          backdropFilter: 'blur(16px)',
          borderRadius: '16px',
          padding: '2.5rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              marginBottom: '1rem',
              boxShadow: '0 8px 16px rgba(2, 132, 199, 0.4)',
            }}
          >
            🔒
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
            {isForced ? 'Bắt buộc đổi mật khẩu' : 'Đổi mật khẩu'}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Tài khoản: <strong style={{ color: '#f8fafc' }}>{user?.email}</strong>
          </p>
        </div>

        {/* Forced mode warning */}
        {isForced && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>⚠️</span>
            <span>Bạn cần đổi mật khẩu trước khi có thể truy cập các tính năng khác của hệ thống.</span>
          </div>
        )}

        {/* Password Policy Guidelines */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(51, 65, 85, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '1.5rem',
            fontSize: '0.8rem',
            color: '#94a3b8',
          }}
        >
          <p style={{ fontWeight: 600, color: '#cbd5e1', marginBottom: '0.25rem' }}>Quy định mật khẩu mới:</p>
          <ul style={{ paddingLeft: '1.25rem', lineHeight: '1.4' }}>
            <li>Độ dài từ 8 đến 64 ký tự</li>
            <li>Không được trùng với email tài khoản</li>
          </ul>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>⛔</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success message */}
        {successMessage && (
          <div
            role="status"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#10b981',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="currentPassword"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.375rem' }}
            >
              Mật khẩu hiện tại
            </label>
            <input
              id="currentPassword"
              type="password"
              required
              disabled={isSubmitting}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: fieldErrors.currentPassword ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                color: '#f8fafc',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
            {fieldErrors.currentPassword && (
              <span style={{ display: 'block', color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                {fieldErrors.currentPassword}
              </span>
            )}
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <label
              htmlFor="newPassword"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.375rem' }}
            >
              Mật khẩu mới
            </label>
            <input
              id="newPassword"
              type="password"
              required
              disabled={isSubmitting}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: fieldErrors.newPassword ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                color: '#f8fafc',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
            {fieldErrors.newPassword && (
              <span style={{ display: 'block', color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                {fieldErrors.newPassword}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '0.875rem',
              borderRadius: '8px',
              backgroundColor: isSubmitting ? '#0369a1' : '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
              marginBottom: '1rem',
            }}
          >
            {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
          </button>
        </form>

        <div style={{ textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <button
            onClick={() => signOut()}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.875rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
