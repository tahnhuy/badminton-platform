import { KeyRound } from 'lucide-react';
import { AccountMenu } from '@/features/auth/account-menu';
import { ROLE_LABELS } from '@/features/auth/role-labels';
import { useAuth } from '@/features/auth/use-auth';

/** Account entry of the Admin header: change password and sign out (Auth PRD §6.9, §7.6). */
export function AdminAccountMenu() {
  const { user } = useAuth();
  if (!user) return null;
  return <AccountMenu triggerLabel="Tài khoản quản trị" name={user.email} detail={ROLE_LABELS[user.role]}
    links={[{ to: '/change-password', label: 'Đổi mật khẩu', icon: KeyRound }]} />;
}
