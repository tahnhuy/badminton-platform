import { Link } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROLE_LABELS } from '@/features/auth/role-labels';
import { useAuth } from '@/features/auth/use-auth';
import { useSignOut } from '@/features/auth/use-sign-out';

/** Account entry of the Admin header: change password and sign out (Auth PRD §6.9, §7.6). */
export function AdminAccountMenu() {
  const { user } = useAuth();
  const signOut = useSignOut();
  if (!user) return null;
  return <DropdownMenu>
    <DropdownMenuTrigger aria-label="Tài khoản quản trị"
      className="ml-1 flex min-h-11 items-center gap-1 rounded-full pl-1 pr-2 text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
      <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {user.email.charAt(0).toUpperCase()}
      </span>
      <ChevronDown aria-hidden="true" className="size-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-64">
      <DropdownMenuLabel>
        <span className="block truncate font-semibold">{user.email}</span>
        <span className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild><Link to="/change-password"><KeyRound aria-hidden="true" />Đổi mật khẩu</Link></DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void signOut()}><LogOut aria-hidden="true" />Đăng xuất</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
