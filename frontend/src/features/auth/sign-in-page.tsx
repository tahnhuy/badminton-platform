import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './use-auth';
import { getRoleHomePath, isPathInRoleArea } from '../../app/role-home';
import { ApiError } from '../../shared/api/http-client';
import { EyeIcon, EyeOffIcon } from '../../components/common/Icons';
import { AuthLayout, AuthAlert } from './auth-layout';

const SUPPORT_CONTACT = import.meta.env.VITE_SUPPORT_CONTACT || 'support@badminton-platform.com';

export function SignInPage() {
  const { signIn, sessionMessage, clearSessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setFieldErrors({});
    clearSessionMessage();

    try {
      const user = await signIn({
        email: email.trim(),
        password,
      });

      if (user.requiresPasswordChange) {
        navigate('/change-password', { replace: true });
      } else {
        const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;
        const target =
          fromPath && isPathInRoleArea(fromPath, user.role) ? fromPath : getRoleHomePath(user.role);
        navigate(target, { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case 'AUTH_INVALID_CREDENTIALS':
            setErrorMessage('Email hoặc mật khẩu không đúng');
            break;

          case 'AUTH_ACCOUNT_RESTRICTED':
            setErrorMessage(
              `Tài khoản của bạn đã bị hạn chế. Vui lòng liên hệ bộ phận hỗ trợ qua ${SUPPORT_CONTACT}.`
            );
            break;

          case 'AUTH_ACCOUNT_LOCKED': {
            const lockedUntilStr = (err.details[0] as { lockedUntil?: string })?.lockedUntil;
            let timeText = '';
            if (lockedUntilStr) {
              const unlockTime = new Date(lockedUntilStr);
              timeText = ` (Mở khóa lúc: ${unlockTime.toLocaleTimeString()})`;
            }
            setErrorMessage(
              `Tài khoản tạm thời bị khóa do nhiều lần đăng nhập thất bại. Vui lòng thử lại sau${timeText}.`
            );
            break;
          }

          case 'AUTH_RATE_LIMITED':
            setErrorMessage('Quá nhiều yêu cầu đăng nhập từ thiết bị của bạn. Vui lòng thử lại sau.');
            break;

          case 'VALIDATION_FAILED': {
            const errors: Record<string, string> = {};
            for (const detail of err.details) {
              if (detail.field) {
                errors[detail.field] = 'Dữ liệu nhập không hợp lệ';
              }
            }
            setFieldErrors(errors);
            setErrorMessage('Vui lòng kiểm tra lại thông tin đã nhập.');
            break;
          }

          default:
            setErrorMessage(err.message || 'Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại.');
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
          <span className="auth-eyebrow">Player Portal</span>
          <h1 className="auth-title">Đăng nhập</h1>
          <p className="auth-subtitle">Chào mừng bạn quay trở lại với SmashPro</p>
        </div>

        {/* Session expired / custom notification message */}
        {sessionMessage && <AuthAlert variant="warning">{sessionMessage}</AuthAlert>}

        {errorMessage && (
          <AuthAlert variant="error" role="alert">
            {errorMessage}
          </AuthAlert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="email" className="auth-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              disabled={isSubmitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@domain.com"
              className={`auth-input${fieldErrors.email ? ' has-error' : ''}`}
            />
            {fieldErrors.email && <span className="auth-field-error">{fieldErrors.email}</span>}
          </div>

          <div className="auth-field">
            <label htmlFor="password" className="auth-label">
              Mật khẩu
            </label>
            <div className="auth-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`auth-input auth-input-with-action${fieldErrors.password ? ' has-error' : ''}`}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>
            {fieldErrors.password && <span className="auth-field-error">{fieldErrors.password}</span>}
          </div>

          <button type="submit" disabled={isSubmitting} className="auth-btn-primary">
            {isSubmitting ? (
              <>
                <span className="auth-spinner" aria-hidden="true" />
                <span>Đang đăng nhập...</span>
              </>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>

        <div className="auth-card-footer">

          <p>
            Chưa có tài khoản?{' '}
            <Link to="/register" className="auth-link">
              Đăng ký người chơi
            </Link>
          </p>
          <p className="auth-support">Hỗ trợ: {SUPPORT_CONTACT}</p>
        </div>
      </div>
    </AuthLayout>
  );
}

