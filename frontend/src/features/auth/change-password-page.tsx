import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './use-auth';
import { getRoleHomePath } from '../../app/role-home';
import { ApiError } from '../../shared/api/http-client';
import { KeyIcon } from '../../components/common/Icons';
import { AuthLayout, AuthAlert } from './auth-layout';

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
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-card-header">
          <div className="auth-card-icon">
            <KeyIcon size={20} />
          </div>
          <h1 className="auth-title">{isForced ? 'Bắt buộc đổi mật khẩu' : 'Đổi mật khẩu'}</h1>
          <p className="auth-subtitle">
            Tài khoản: <strong>{user?.email}</strong>
          </p>
        </div>

        {isForced && (
          <AuthAlert variant="warning">
            Bạn cần đổi mật khẩu trước khi có thể truy cập các tính năng khác của hệ thống.
          </AuthAlert>
        )}

        <AuthAlert variant="info">
          <strong>Quy định mật khẩu mới:</strong>
          <ul>
            <li>Độ dài từ 8 đến 64 ký tự</li>
            <li>Không được trùng với email tài khoản</li>
          </ul>
        </AuthAlert>

        {errorMessage && (
          <AuthAlert variant="error" role="alert">
            {errorMessage}
          </AuthAlert>
        )}

        {successMessage && (
          <AuthAlert variant="success" role="status">
            {successMessage}
          </AuthAlert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="currentPassword" className="auth-label">
              Mật khẩu hiện tại
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              disabled={isSubmitting}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className={`auth-input${fieldErrors.currentPassword ? ' has-error' : ''}`}
            />
            {fieldErrors.currentPassword && (
              <span className="auth-field-error">{fieldErrors.currentPassword}</span>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="newPassword" className="auth-label">
              Mật khẩu mới
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              required
              disabled={isSubmitting}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className={`auth-input${fieldErrors.newPassword ? ' has-error' : ''}`}
            />
            {fieldErrors.newPassword && <span className="auth-field-error">{fieldErrors.newPassword}</span>}
          </div>

          <button type="submit" disabled={isSubmitting} className="auth-btn-primary">
            {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
          </button>
        </form>

        <div className="auth-card-footer">
          <button type="button" onClick={() => signOut()} className="auth-link">
            Đăng xuất
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
