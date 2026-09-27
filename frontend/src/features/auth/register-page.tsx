import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './use-auth';
import { authApi, type SkillLevel } from './auth-api';
import { ApiError } from '../../shared/api/http-client';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [skillLevelCode, setSkillLevelCode] = useState('');

  const [skillLevels, setSkillLevels] = useState<SkillLevel[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(true);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    authApi

      .listSkillLevels()
      .then((res) => {
        if (!mounted) return;
        setSkillLevels(res.data);
        if (res.data.length > 0) {
          setSkillLevelCode(res.data[0].code);
        }
        setIsLoadingSkills(false);
      })
      .catch(() => {
        if (!mounted) return;
        setSkillsError('Không thể tải danh sách trình độ kỹ năng. Vui lòng tải lại trang.');
        setIsLoadingSkills(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isLoadingSkills || skillsError) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setFieldErrors({});

    try {
      await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        skillLevelCode,
      });

      setSuccessMessage('Đăng ký thành công! Đang chuyển đến trang chủ...');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1000);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case 'AUTH_EMAIL_ALREADY_REGISTERED':
            setErrorMessage('Email này đã được đăng ký. Vui lòng chọn email khác hoặc đăng nhập.');
            setFieldErrors({ email: 'Email đã tồn tại trong hệ thống' });
            break;

          case 'AUTH_PASSWORD_POLICY_VIOLATION':
            setErrorMessage('Mật khẩu không thỏa mãn yêu cầu: phải có 8-64 ký tự và không được trùng với email.');
            setFieldErrors({ password: 'Mật khẩu phải từ 8-64 ký tự và khác email' });
            break;

          case 'AUTH_INVALID_SKILL_LEVEL':
            setErrorMessage('Cấp độ kỹ năng được chọn không hợp lệ.');
            setFieldErrors({ skillLevelCode: 'Trình độ không hợp lệ' });
            break;

          case 'AUTH_RATE_LIMITED':
            setErrorMessage('Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau.');
            break;

          case 'VALIDATION_FAILED': {
            const errors: Record<string, string> = {};
            for (const detail of err.details) {
              if (detail.field) {
                errors[detail.field] = 'Dữ liệu không hợp lệ';
              }
            }
            setFieldErrors(errors);
            setErrorMessage('Vui lòng kiểm tra lại các trường thông tin.');
            break;
          }

          default:
            setErrorMessage(err.message || 'Đã xảy ra lỗi trong quá trình đăng ký.');
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
          maxWidth: '520px',
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
              background: 'linear-gradient(135deg, #10b981, #34d399)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              marginBottom: '1rem',
              boxShadow: '0 8px 16px rgba(16, 185, 129, 0.3)',
            }}
          >
            🏸
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
            Đăng ký người chơi
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Tham gia cộng đồng cầu lông và bắt đầu tìm kiếm trận đấu phù hợp
          </p>
        </div>

        {/* Global error */}
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

        {/* Skills load error */}
        {skillsError && (
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
            }}
          >
            {skillsError}
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
            }}
          >
            ✅ {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="fullName"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.375rem' }}
            >
              Họ và tên
            </label>
            <input
              id="fullName"
              type="text"
              required
              disabled={isSubmitting}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: fieldErrors.fullName ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                color: '#f8fafc',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
            {fieldErrors.fullName && (
              <span style={{ display: 'block', color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                {fieldErrors.fullName}
              </span>
            )}
          </div>

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
              }}
            />
            {fieldErrors.email && (
              <span style={{ display: 'block', color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
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
              }}
            />
            <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              8–64 ký tự, không được trùng với email
            </span>
            {fieldErrors.password && (
              <span style={{ display: 'block', color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                {fieldErrors.password}
              </span>
            )}
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <label
              htmlFor="skillLevelCode"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.375rem' }}
            >
              Trình độ kỹ năng
            </label>
            <select
              id="skillLevelCode"
              disabled={isSubmitting || isLoadingSkills || !!skillsError}
              value={skillLevelCode}
              onChange={(e) => setSkillLevelCode(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: fieldErrors.skillLevelCode ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            >
              {isLoadingSkills && <option value="">Đang tải danh sách cấp độ...</option>}
              {skillLevels.map((lvl) => (
                <option key={lvl.code} value={lvl.code}>
                  {lvl.name} (Hạng {lvl.rank}) - {lvl.description}
                </option>
              ))}
            </select>
            {fieldErrors.skillLevelCode && (
              <span style={{ display: 'block', color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                {fieldErrors.skillLevelCode}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isLoadingSkills || !!skillsError}
            style={{
              width: '100%',
              padding: '0.875rem',
              borderRadius: '8px',
              backgroundColor: isSubmitting ? '#059669' : '#10b981',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: isSubmitting || isLoadingSkills || !!skillsError ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              transition: 'background-color 0.2s',
            }}
          >
            {isSubmitting ? 'Đang tạo tài khoản...' : 'Đăng ký ngay'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Đã có tài khoản?{' '}
            <Link to="/sign-in" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 500 }}>
              Đăng nhập tại đây
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
