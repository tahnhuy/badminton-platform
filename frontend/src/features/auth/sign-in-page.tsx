import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './use-auth';
import { getRoleHomePath } from '../../app/role-home';
import { ApiError } from '../../shared/api/http-client';

const SUPPORT_CONTACT = import.meta.env.VITE_SUPPORT_CONTACT || 'support@badminton-platform.com';

export function SignInPage() {
  const { signIn, sessionMessage, clearSessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        navigate(fromPath || getRoleHomePath(user.role), { replace: true });
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
          maxWidth: '440px',
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
            🏸
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
            Đăng nhập
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Chào mừng bạn quay trở lại với Badminton Platform
          </p>
        </div>

        {/* Session expired / custom notification message */}
        {sessionMessage && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#f59e0b',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>⚠️</span>
            <span>{sessionMessage}</span>
          </div>
        )}

        {/* Error alert */}
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

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="email"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.375rem' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              disabled={isSubmitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@domain.com"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: fieldErrors.email ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                color: '#f8fafc',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
            {fieldErrors.email && (
              <span style={{ display: 'block', color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <label
              htmlFor="password"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.375rem' }}
            >
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              required
              disabled={isSubmitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: fieldErrors.password ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                color: '#f8fafc',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
            {fieldErrors.password && (
              <span style={{ display: 'block', color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                {fieldErrors.password}
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
              transition: 'background-color 0.2s, transform 0.1s',
            }}
          >
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Chưa có tài khoản?{' '}
            <Link to="/register" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 500 }}>
              Đăng ký người chơi
            </Link>
          </p>

          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.75rem' }}>
            Hỗ trợ: <span style={{ color: '#94a3b8' }}>{SUPPORT_CONTACT}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
