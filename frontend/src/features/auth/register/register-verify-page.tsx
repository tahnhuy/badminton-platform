import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, LoaderCircle, MailCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LabeledInput } from '@/components/common/labeled-input';
import { ApiError } from '@/shared/api/http-client';
import { authApi, type RegistrationChallenge } from '../auth-api';
import { useAuth } from '../use-auth';
import { clearRegisterDraft } from './register-draft';
import { RegisterShell } from './register-shell';
import type { RegisterResultState } from './register-result-state';

interface VerifyState {
  challenge?: RegistrationChallenge;
  email?: string;
  fullName?: string;
}

const VERIFY_STATE_KEY = 'smashpro.registerVerify.v1';

function maskEmail(email: string | undefined): string {
  if (!email) return 'email của bạn';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const head = local.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(2, local.length - 1))}@${domain}`;
}

function readVerifyState(): VerifyState {
  try {
    const raw = sessionStorage.getItem(VERIFY_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as VerifyState;
    if (!parsed.challenge || typeof parsed.challenge.challengeId !== 'string') return {};
    if (new Date(parsed.challenge.expiresAt).getTime() <= Date.now()) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeVerifyState(state: VerifyState) {
  try { sessionStorage.setItem(VERIFY_STATE_KEY, JSON.stringify(state)); } catch { /* storage may be unavailable */ }
}

function clearVerifyState() {
  try { sessionStorage.removeItem(VERIFY_STATE_KEY); } catch { /* ignore */ }
}

function otpErrorMessage(reason: unknown): string {
  if (!(reason instanceof ApiError)) return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
  switch (reason.code) {
    case 'AUTH_OTP_INVALID': return 'Mã xác minh không đúng. Vui lòng kiểm tra lại.';
    case 'AUTH_OTP_EXPIRED': return 'Mã xác minh đã hết hạn. Hãy bắt đầu lại yêu cầu để nhận mã mới.';
    case 'AUTH_OTP_LOCKED': return 'Bạn đã nhập sai quá nhiều lần nên mã này bị khóa. Hãy bắt đầu lại yêu cầu để nhận mã mới.';
    case 'AUTH_OTP_RESEND_TOO_SOON': return 'Vui lòng chờ một chút trước khi gửi lại mã.';
    case 'AUTH_RATE_LIMITED': return 'Bạn đã yêu cầu quá nhiều mã. Vui lòng thử lại sau.';
    case 'AUTH_EMAIL_ALREADY_REGISTERED': return 'Email này vừa được đăng ký. Hãy đăng nhập hoặc quên mật khẩu.';
    default: return 'Không thể xác minh mã. Vui lòng thử lại.';
  }
}

/** `/register/verify` — email OTP step that completes registration (email-otp plan §3.1). */
export function RegisterVerifyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyRegistration } = useAuth();
  const [state] = useState<VerifyState>(() => {
    const routed = (location.state ?? {}) as VerifyState;
    return routed.challenge ? routed : readVerifyState();
  });

  const [challenge, setChallenge] = useState<RegistrationChallenge | undefined>(state.challenge);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (state.challenge && state.email) writeVerifyState(state);
  }, [state]);

  const resendInSeconds = useMemo(() => {
    if (!challenge) return 0;
    const remaining = new Date(challenge.resendAvailableAt).getTime() - now;
    return Math.max(0, Math.ceil(remaining / 1000));
  }, [challenge, now]);

  const submit = useCallback(async () => {
    if (!challenge || otp.length !== 6 || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await verifyRegistration({ challengeId: challenge.challengeId, otp });
      clearRegisterDraft();
      clearVerifyState();
      const resultState: RegisterResultState = { result, fullName: state.fullName ?? '' };
      navigate('/register/result', { replace: true, state: resultState });
    } catch (reason) {
      setError(otpErrorMessage(reason));
      if (reason instanceof ApiError && reason.code === 'AUTH_EMAIL_ALREADY_REGISTERED') {
        setChallenge(undefined);
      }
    } finally {
      setSubmitting(false);
    }
  }, [challenge, otp, submitting, verifyRegistration, navigate, state.fullName]);

  const resend = useCallback(async () => {
    if (!challenge || resending || resendInSeconds > 0) return;
    setResending(true);
    setError(null);
    try {
      const response = await authApi.resendRegistrationOtp({ challengeId: challenge.challengeId });
      setChallenge(response.data);
      setOtp('');
      setNotice('Đã gửi lại mã xác minh. Mã cũ không còn hiệu lực.');
    } catch (reason) {
      setError(otpErrorMessage(reason));
    } finally {
      setResending(false);
    }
  }, [challenge, resending, resendInSeconds]);

  if (!challenge) {
    return <Navigate to="/register" replace state={undefined} />;
  }

  return <RegisterShell note="Xác minh email đăng ký" signInLink>
    <main aria-label="Xác minh email đăng ký" className="mx-auto max-w-110 rounded-panel border border-border bg-card px-6 py-9 shadow-panel sm:px-10">
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary"><MailCheck className="size-6" /></span>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">Nhập mã xác minh</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Mã gồm 6 chữ số đã gửi tới <strong className="break-all text-foreground">{maskEmail(state.email)}</strong>. Mã có hiệu lực 5 phút.
      </p>

      {error && <Alert variant="destructive" role="alert" className="mt-5">{error}</Alert>}
      {notice && <Alert variant="success" role="status" className="mt-5">{notice}</Alert>}

      <form className="mt-6 grid gap-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <LabeledInput id="register-otp" label="Mã xác minh" icon={MailCheck} type="text" inputMode="numeric" autoComplete="one-time-code"
          maxLength={6} required placeholder="123456" value={otp}
          onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
        <Button type="submit" variant="brand" size="comfortable" disabled={submitting || otp.length !== 6} aria-busy={submitting}>
          {submitting ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><span role="status">Đang xác minh…</span></> : 'Xác minh và tạo tài khoản'}
        </Button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <Button type="button" variant="ghost" className="h-11 px-2 text-primary" onClick={() => { clearVerifyState(); navigate('/register', { state: { previousChallengeId: challenge.challengeId } }); }}>
          <ArrowLeft aria-hidden="true" />Đổi email
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={() => void resend()} disabled={resending || resendInSeconds > 0}>
          {resending ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />Đang gửi…</>
            : resendInSeconds > 0 ? <><Clock aria-hidden="true" />Gửi lại sau {resendInSeconds}s</> : 'Gửi lại mã'}
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Không nhận được email? Kiểm tra thư rác hoặc <Link to="/sign-in" className="font-semibold text-primary underline">đăng nhập</Link> nếu bạn đã có tài khoản.</p>
    </main>
  </RegisterShell>;
}
