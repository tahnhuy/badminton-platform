import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './use-auth';
import { authApi, type SkillLevel } from './auth-api';
import { ApiError } from '../../shared/api/http-client';
import { AuthLayout, AuthAlert } from './auth-layout';

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
    <AuthLayout>
      <div className="auth-card auth-card-wide">
        <div className="auth-card-header">
          <span className="auth-eyebrow">Tài khoản mới</span>
          <h1 className="auth-title">Đăng ký người chơi</h1>
          <p className="auth-subtitle">
            Tham gia cộng đồng cầu lông và bắt đầu tìm kiếm trận đấu phù hợp
          </p>
        </div>

        {errorMessage && (
          <AuthAlert variant="error" role="alert">
            {errorMessage}
          </AuthAlert>
        )}

        {skillsError && (
          <AuthAlert variant="error" role="alert">
            {skillsError}
          </AuthAlert>
        )}

        {successMessage && (
          <AuthAlert variant="success" role="status">
            {successMessage}
          </AuthAlert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="fullName" className="auth-label">
              Họ và tên
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              disabled={isSubmitting}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className={`auth-input${fieldErrors.fullName ? ' has-error' : ''}`}
            />
            {fieldErrors.fullName && <span className="auth-field-error">{fieldErrors.fullName}</span>}
          </div>

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
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              disabled={isSubmitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`auth-input${fieldErrors.password ? ' has-error' : ''}`}
            />
            <span className="auth-hint">8–64 ký tự, không được trùng với email</span>
            {fieldErrors.password && <span className="auth-field-error">{fieldErrors.password}</span>}
          </div>

          <div className="auth-field">
            <label htmlFor="skillLevelCode" className="auth-label">
              Trình độ kỹ năng
            </label>
            <select
              id="skillLevelCode"
              disabled={isSubmitting || isLoadingSkills || !!skillsError}
              value={skillLevelCode}
              onChange={(e) => setSkillLevelCode(e.target.value)}
              className={`auth-input${fieldErrors.skillLevelCode ? ' has-error' : ''}`}
            >
              {isLoadingSkills && <option value="">Đang tải danh sách cấp độ...</option>}
              {skillLevels.map((lvl) => (
                <option key={lvl.code} value={lvl.code}>
                  {lvl.name} (Hạng {lvl.rank}) - {lvl.description}
                </option>
              ))}
            </select>
            {fieldErrors.skillLevelCode && (
              <span className="auth-field-error">{fieldErrors.skillLevelCode}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isLoadingSkills || !!skillsError}
            className="auth-btn-primary"
          >
            {isSubmitting ? 'Đang tạo tài khoản...' : 'Đăng ký ngay'}
          </button>
        </form>

        <div className="auth-card-footer">
          <p>
            Đã có tài khoản?{' '}
            <Link to="/sign-in" className="auth-link">
              Đăng nhập tại đây
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
