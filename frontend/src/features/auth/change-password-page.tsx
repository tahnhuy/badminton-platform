import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, TriangleAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FocusAlert } from '@/components/common/focus-alert';
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

export function ChangePasswordPage() {
  const { form, submit, error, email, isForced, signOut } = useChangePasswordForm();
  const { isSubmitting } = form.formState;
  return <AuthFocusLayout action={isForced ? undefined : <BackButton />}>
    <header className="mb-7">
      <p className="mb-3 text-2xs font-semibold tracking-widest text-primary">{isForced ? 'BẢO MẬT TÀI KHOẢN' : 'TÀI KHOẢN'}</p>
      <h1 className="text-3xl font-bold tracking-tight">
        {isForced ? 'Bắt buộc đổi mật khẩu' : 'Đổi mật khẩu'}<span aria-hidden="true" className="text-primary">.</span>
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Tài khoản: <strong className="break-all font-semibold text-foreground">{email}</strong>
        <br />Sau khi đổi, bạn sẽ đăng nhập lại bằng mật khẩu mới.
      </p>
    </header>
    {isForced && <Alert variant="warning" role="status" className="mb-5 flex items-start gap-3">
      <TriangleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />
      <span>Bạn cần đổi mật khẩu trước khi có thể truy cập các tính năng khác của hệ thống.</span>
    </Alert>}
    <FocusAlert message={error} className="mb-5" />
    <ChangePasswordForm form={form} submit={submit} email={email} />
    <footer className="mt-6 flex justify-center border-t border-border pt-4">
      <Button type="button" variant="ghost" disabled={isSubmitting} onClick={() => void signOut()}>
        <LogOut aria-hidden="true" />Đăng xuất
      </Button>
    </footer>
  </AuthFocusLayout>;
}
