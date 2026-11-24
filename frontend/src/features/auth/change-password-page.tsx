import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, LoaderCircle, LogOut, MailCheck, TriangleAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FocusAlert } from '@/components/common/focus-alert';
import { LabeledInput } from '@/components/common/labeled-input';
import { getRoleHomePath } from '@/app/role-home';
import { AuthFocusLayout } from './auth-focus-layout';
import { ChangePasswordForm } from './change-password-form';
import { useAuth } from './use-auth';
import { useChangePasswordForm } from './use-change-password-form';

function BackButton() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // 'default' marks the first history entry: there is no in-app page to return to.
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate(user ? getRoleHomePath(user.role) : '/'));
  return <Button type="button" variant="ghost" onClick={goBack}><ArrowLeft aria-hidden="true" />Quay lại</Button>;
}

type ChangePasswordState = ReturnType<typeof useChangePasswordForm>;

function ChangeOtpPanel({ state }: { state: ChangePasswordState }) {
  const { otpStage, otp, setOtp, otpError, otpNotice, otpBusy, resendInSeconds, requestOtp, verifyOtp, resendOtp } = state;
  if (otpStage === 'INTRO') {
    return <section aria-label="Xác minh email" className="rounded-2xl border border-border bg-soft p-5">
      <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary"><MailCheck className="size-5" /></span>
      <h2 className="mt-3 text-base font-extrabold">Xác minh email trước khi đổi mật khẩu</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">Hệ thống sẽ gửi mã 6 chữ số tới email tài khoản để xác nhận đây là bạn.</p>
      {otpError && <Alert variant="destructive" role="alert" className="mt-4">{otpError}</Alert>}
      <Button type="button" variant="brand" size="comfortable" className="mt-4 w-full" disabled={otpBusy} aria-busy={otpBusy} onClick={() => void requestOtp()}>
        {otpBusy ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><span role="status">Đang gửi…</span></> : 'Gửi mã xác minh'}
      </Button>
    </section>;
  }
  return <section aria-label="Nhập mã xác minh" className="rounded-2xl border border-border bg-soft p-5">
    <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary"><MailCheck className="size-5" /></span>
    <h2 className="mt-3 text-base font-extrabold">Nhập mã xác minh</h2>
    <p className="mt-1 text-sm leading-6 text-muted-foreground">Mã 6 chữ số đã được gửi tới email tài khoản. Mã có hiệu lực trong vài phút.</p>
    {otpError && <Alert variant="destructive" role="alert" className="mt-4">{otpError}</Alert>}
    {otpNotice && <Alert variant="success" role="status" className="mt-4">{otpNotice}</Alert>}
    <div className="mt-4 grid gap-3">
      <LabeledInput id="change-password-otp" label="Mã xác minh" icon={MailCheck} type="text" inputMode="numeric" autoComplete="one-time-code"
        maxLength={6} required placeholder="123456" value={otp} disabled={otpBusy}
        onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
      <Button type="button" variant="brand" size="comfortable" disabled={otpBusy || otp.length !== 6} aria-busy={otpBusy} onClick={() => void verifyOtp()}>
        {otpBusy ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><span role="status">Đang xác minh…</span></> : 'Xác minh mã'}
      </Button>
      <Button type="button" variant="outline" className="h-11" disabled={otpBusy || resendInSeconds > 0} onClick={() => void resendOtp()}>
        {resendInSeconds > 0 ? <><Clock aria-hidden="true" />Gửi lại sau {resendInSeconds}s</> : 'Gửi lại mã'}
      </Button>
    </div>
  </section>;
}

export function ChangePasswordPage() {
  const state = useChangePasswordForm();
  const { form, submit, error, email, isForced, signOut, otpStage } = state;
  const { isSubmitting } = form.formState;
  const showOtp = !isForced && otpStage !== 'DONE';
  return <AuthFocusLayout action={isForced ? undefined : <BackButton />}>
    <header className="mb-7">
      <p className="mb-3 text-2xs font-semibold tracking-widest text-primary">{isForced ? 'BẢO MẬT TÀI KHOẢN' : 'TÀI KHOẢN'}</p>
      <h1 className="text-3xl font-bold tracking-tight">
        {isForced ? 'Bắt buộc đổi mật khẩu' : 'Đổi mật khẩu'}<span aria-hidden="true" className="text-primary">.</span>
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Tài khoản: <strong className="break-all font-semibold text-foreground">{email}</strong>
        <br />{showOtp ? 'Xác minh email trước khi nhập mật khẩu mới.' : 'Sau khi đổi, bạn sẽ đăng nhập lại bằng mật khẩu mới.'}
      </p>
    </header>
    {isForced && <Alert variant="warning" role="status" className="mb-5 flex items-start gap-3">
      <TriangleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />
      <span>Bạn cần đổi mật khẩu trước khi có thể truy cập các tính năng khác của hệ thống.</span>
    </Alert>}
    {showOtp
      ? <ChangeOtpPanel state={state} />
      : <>
        <FocusAlert message={error} className="mb-5" />
        <ChangePasswordForm form={form} submit={submit} email={email} />
      </>}
    <footer className="mt-6 flex justify-center border-t border-border pt-4">
      <Button type="button" variant="ghost" disabled={isSubmitting} onClick={() => void signOut()}>
        <LogOut aria-hidden="true" />Đăng xuất
      </Button>
    </footer>
  </AuthFocusLayout>;
}
