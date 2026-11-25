import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, CircleCheck, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { FocusAlert } from '@/components/common/focus-alert';
import { ShuttlecockIcon } from '@/components/common/Icons';
import { SignInLayout } from './sign-in-layout';
import { SignInForm } from './sign-in-form';
import { useAuth } from './use-auth';
import { useSignInForm } from './use-sign-in-form';

export function SignInPage() {
  const { form, submit, error, sessionMessage, justRegistered } = useSignInForm();
  const passwordChanged = useAuth().signOutReason === 'passwordChanged';
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  return <SignInLayout>
    <div className="relative mx-auto w-full max-w-95">
      <header className="mb-8">
        <div aria-hidden="true" className="mb-6 hidden size-11 items-center justify-center rounded-2xl border border-border bg-background text-primary min-[50.0625rem]:flex"><ShuttlecockIcon size={25} className="-rotate-14" /></div>
        <p className="mb-3 text-2xs font-semibold tracking-widest text-primary">CHÀO MỪNG TRỞ LẠI</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Đăng nhập<span aria-hidden="true" className="text-primary">.</span></h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Một tài khoản để kết nối và cùng ra sân.</p>
      </header>
      {notice && !error && <Alert variant="success" role="status" className="mb-5">{notice}</Alert>}
      {passwordChanged && !error && <Alert variant="success" role="status" className="mb-5 flex items-start gap-3">
        <CircleCheck aria-hidden="true" className="mt-1 size-4 shrink-0" /><span>Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.</span>
      </Alert>}
      {justRegistered && !passwordChanged && !error && <Alert variant="success" role="status" className="mb-5 flex items-start gap-3">
        <CircleCheck aria-hidden="true" className="mt-1 size-4 shrink-0" /><span>Tạo tài khoản thành công. Đăng nhập để bắt đầu.</span>
      </Alert>}
      {sessionMessage && <Alert variant="warning" role="status" className="mb-5">Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.</Alert>}
      <FocusAlert message={error} className="mb-5" />
      <SignInForm form={form} submit={submit} />
      <p className="mt-3 text-right text-xs">
        <Link to="/forgot-password" className="font-semibold text-primary underline-offset-4 hover:underline">Quên mật khẩu?</Link>
      </p>
      <p className="mt-5 text-center text-xs text-muted-foreground">Lần đầu đến SmashPro?{' '}
        <Link to="/register" className="group inline-flex min-h-11 items-center gap-1 rounded-md font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          Tạo tài khoản<ArrowUpRight aria-hidden="true" className="size-3.5 transition-transform duration-200 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5" />
        </Link>
      </p>
      <footer className="mt-5 flex items-center justify-center gap-2 border-t border-border pt-6 text-xs leading-6 text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="size-3.5" /><p>Một tài khoản. Kết nối cả cộng đồng.</p>
      </footer>
    </div>
  </SignInLayout>;
}
