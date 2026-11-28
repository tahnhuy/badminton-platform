import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, KeyRound, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LabeledInput } from '@/components/common/labeled-input';
import { PasswordInput } from '@/components/common/password-input';
import { ApiError } from '@/shared/api/http-client';
import { authApi, type RegistrationChallenge, type ResetAuthorization } from './auth-api';
import { SignInLayout } from './sign-in-layout';
import { hasValidPasswordLength, hasPasswordLettersAndNumbers, isPasswordSameAsEmail } from './password-policy';

type Step = 'EMAIL' | 'OTP' | 'PASSWORD';

function messageFor(reason: unknown): string {
  if (!(reason instanceof ApiError)) return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
  switch (reason.code) {
    case 'AUTH_OTP_INVALID': return 'Mã xác minh không đúng. Vui lòng kiểm tra lại.';
    case 'AUTH_OTP_EXPIRED': return 'Mã xác minh đã hết hạn. Hãy bắt đầu lại yêu cầu để nhận mã mới.';
    case 'AUTH_OTP_LOCKED': return 'Bạn đã nhập sai quá nhiều lần nên mã này bị khóa. Hãy bắt đầu lại yêu cầu để nhận mã mới.';
    case 'AUTH_OTP_RESEND_TOO_SOON': return 'Vui lòng chờ một chút trước khi gửi lại mã.';
    case 'AUTH_RATE_LIMITED': return 'Bạn đã yêu cầu quá nhiều mã. Vui lòng thử lại sau.';
    case 'AUTH_RESET_TOKEN_INVALID': return 'Quyền đặt lại đã hết hạn. Vui lòng xác minh lại email.';
    case 'AUTH_PASSWORD_POLICY_VIOLATION': return 'Mật khẩu phải có từ 8 đến 64 ký tự, gồm chữ và số, không được trùng với email.';
    case 'VALIDATION_FAILED': return 'Vui lòng kiểm tra lại thông tin đã nhập.';
    default: return 'Không thể hoàn tất. Vui lòng thử lại.';
  }
}

/** Public password recovery: email → OTP → new password (email-otp plan §3.2). */
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('EMAIL');
  // The Court Owner account-created email links here with `?email=` (partnership request tech design §3).
  const [email, setEmail] = useState(() => searchParams.get('email')?.trim().slice(0, 254) ?? '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [challenge, setChallenge] = useState<RegistrationChallenge | null>(null);
  const [authorization, setAuthorization] = useState<ResetAuthorization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const resendInSeconds = useMemo(() => {
    if (!challenge) return 0;
    return Math.max(0, Math.ceil((new Date(challenge.resendAvailableAt).getTime() - now) / 1000));
  }, [challenge, now]);

  const requestCode = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await authApi.forgotPassword({ email: email.trim() });
      setChallenge(response.data);
      setStep('OTP');
      setNotice('Nếu email thuộc một tài khoản đang hoạt động, mã xác minh đã được gửi.');
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSubmitting(false);
    }
  }, [email]);

  const verify = useCallback(async () => {
    if (!challenge) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await authApi.verifyPasswordReset({ challengeId: challenge.challengeId, otp });
      setAuthorization(response.data);
      setStep('PASSWORD');
      setNotice(null);
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSubmitting(false);
    }
  }, [challenge, otp]);

  const resend = useCallback(async () => {
    if (!challenge || resendInSeconds > 0) return;
    setResending(true);
    setError(null);
    try {
      const response = await authApi.resendPasswordResetOtp({ challengeId: challenge.challengeId });
      setChallenge(response.data);
      setOtp('');
      setNotice('Đã gửi lại mã xác minh. Mã cũ không còn hiệu lực.');
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setResending(false);
    }
  }, [challenge, resendInSeconds]);

  const reset = useCallback(async () => {
    if (!authorization) return;
    if (!hasValidPasswordLength(password) || !hasPasswordLettersAndNumbers(password) || isPasswordSameAsEmail(password, email)) {
      setError('Mật khẩu phải có từ 8 đến 64 ký tự, gồm chữ và số, không được trùng với email.');
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await authApi.resetPassword({ resetToken: authorization.resetToken, newPassword: password });
      navigate('/sign-in', { replace: true, state: { notice: 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại.' } });
    } catch (reason) {
      setError(messageFor(reason));
      if (reason instanceof ApiError && reason.code === 'AUTH_RESET_TOKEN_INVALID') {
        // The one-time authorization is gone; the password step cannot succeed again.
        setAuthorization(null);
        setChallenge(null);
        setOtp('');
        setPassword('');
        setConfirm('');
        setStep('EMAIL');
      }
    } finally {
      setSubmitting(false);
    }
  }, [authorization, password, confirm, email, navigate]);

  return <SignInLayout>
    <div className="relative mx-auto w-full max-w-95">
      <header className="mb-7">
        <div aria-hidden="true" className="mb-6 hidden size-11 items-center justify-center rounded-2xl border border-border bg-background text-primary min-[50.0625rem]:flex"><ShieldCheck className="size-6" /></div>
        <p className="mb-3 text-2xs font-semibold tracking-widest text-primary">KHÔI PHỤC TÀI KHOẢN</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Quên mật khẩu<span aria-hidden="true" className="text-primary">.</span></h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {step === 'EMAIL' ? 'Nhập email tài khoản để nhận mã xác minh.' : step === 'OTP' ? 'Nhập mã 6 chữ số đã gửi tới email của bạn.' : 'Đặt mật khẩu mới cho tài khoản.'}
        </p>
      </header>

      {error && <Alert variant="destructive" role="alert" className="mb-5">{error}</Alert>}
      {notice && <Alert variant="success" role="status" className="mb-5">{notice}</Alert>}

      {step === 'EMAIL' && <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void requestCode(); }}>
        <LabeledInput id="forgot-email" label="Email" icon={Mail} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
          required placeholder="ban@example.com" disabled={submitting} value={email} onChange={event => setEmail(event.target.value)} />
        <Button type="submit" variant="brand" size="comfortable" disabled={submitting || !email.trim()} aria-busy={submitting}>
          {submitting ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><span role="status">Đang gửi…</span></> : 'Gửi mã xác minh'}
        </Button>
      </form>}

      {step === 'OTP' && <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void verify(); }}>
        <LabeledInput id="forgot-otp" label="Mã xác minh" icon={Mail} type="text" inputMode="numeric" autoComplete="one-time-code"
          maxLength={6} required placeholder="123456" value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
        <Button type="submit" variant="brand" size="comfortable" disabled={submitting || otp.length !== 6} aria-busy={submitting}>
          {submitting ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><span role="status">Đang xác minh…</span></> : 'Xác minh mã'}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" className="h-11 px-2 text-primary" onClick={() => { setStep('EMAIL'); setChallenge(null); setOtp(''); setError(null); setNotice(null); }}>
            <ArrowLeft aria-hidden="true" />Đổi email
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => void resend()} disabled={resending || resendInSeconds > 0}>
            {resending ? 'Đang gửi…' : resendInSeconds > 0 ? <><Clock aria-hidden="true" />Gửi lại sau {resendInSeconds}s</> : 'Gửi lại mã'}
          </Button>
        </div>
      </form>}

      {step === 'PASSWORD' && <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void reset(); }}>
        <PasswordInput id="forgot-password" label="Mật khẩu mới" toggleLabel="mật khẩu" autoComplete="new-password" required
          value={password} onChange={event => setPassword(event.target.value)} placeholder="8–64 ký tự, gồm chữ và số" />
        <PasswordInput id="forgot-password-confirm" label="Nhập lại mật khẩu mới" toggleLabel="mật khẩu" autoComplete="new-password" required
          value={confirm} onChange={event => setConfirm(event.target.value)} placeholder="Nhập lại mật khẩu" />
        <Button type="submit" variant="brand" size="comfortable" disabled={submitting} aria-busy={submitting}>
          {submitting ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><span role="status">Đang cập nhật…</span></> : <><KeyRound aria-hidden="true" />Đặt lại mật khẩu</>}
        </Button>
      </form>}

      <p className="mt-5 text-center text-xs text-muted-foreground">
        <Link to="/sign-in" className="font-semibold text-primary underline">Quay lại đăng nhập</Link>
      </p>
    </div>
  </SignInLayout>;
}
