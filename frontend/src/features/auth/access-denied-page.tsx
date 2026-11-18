import { Link } from 'react-router-dom';
import { LockKeyhole, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRoleHomePath } from '@/app/role-home';
import { AuthFocusLayout } from './auth-focus-layout';
import { ROLE_LABELS } from './role-labels';
import { useAuth } from './use-auth';
import { useSignOut } from './use-sign-out';

/** Rendered by the route guard at the blocked URL; the backend still enforces every permission. */
export function AccessDeniedPage() {
  const { user } = useAuth();
  const signOut = useSignOut();
  return <AuthFocusLayout>
    <div className="text-center">
      <span aria-hidden="true" className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-danger-bg text-destructive">
        <LockKeyhole className="size-6" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">Bạn không có quyền truy cập trang này</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Trang này dành cho vai trò khác.
        {user && <> Bạn đang đăng nhập với vai trò <strong className="font-semibold text-foreground">{ROLE_LABELS[user.role]}</strong>.</>}
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Button asChild variant="brand" size="comfortable" className="w-full">
          <Link to={user ? getRoleHomePath(user.role) : '/sign-in'}>Về trang của bạn</Link>
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={() => void signOut()}>
          <LogOut aria-hidden="true" />Đăng xuất
        </Button>
      </div>
    </div>
  </AuthFocusLayout>;
}
