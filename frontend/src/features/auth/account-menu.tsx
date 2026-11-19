import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, type LucideIcon } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';
import { useSignOut } from './use-sign-out';

export interface AccountMenuLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface AccountMenuProps {
  /** Accessible name of the trigger, e.g. "Tài khoản của tôi". */
  triggerLabel: string;
  name: string;
  detail: string;
  avatarUrl?: string | null;
  links: AccountMenuLink[];
  /** Show the name beside the avatar from 1280 px. */
  showName?: boolean;
}

/** Account entry shared by the app shells: identity, account links and sign-out (Auth PRD §7.6). */
export function AccountMenu({ triggerLabel, name, detail, avatarUrl, links, showName = false }: AccountMenuProps) {
  const signOut = useSignOut();
  return <DropdownMenu>
    <DropdownMenuTrigger aria-label={triggerLabel}
      className="flex min-h-11 items-center gap-2 rounded-full p-1 pr-2 text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
      {avatarUrl
        ? <img src={avatarUrl} alt="" className="size-9 rounded-full object-cover" />
        : <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{name.charAt(0).toUpperCase()}</span>}
      {showName && <span className="hidden max-w-40 flex-col text-left leading-tight xl:flex">
        <span className="truncate text-sm font-semibold text-foreground">{name}</span>
        <span className="truncate text-xs">{detail}</span>
      </span>}
      <ChevronDown aria-hidden="true" className="size-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-64">
      <DropdownMenuLabel>
        <span className="block truncate font-semibold">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {links.map(({ to, label, icon: Icon }) => <DropdownMenuItem key={to} asChild>
        <Link to={to}><Icon aria-hidden="true" />{label}</Link>
      </DropdownMenuItem>)}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => void signOut()} className={cn('text-destructive focus:bg-danger-bg focus:text-destructive')}>
        <LogOut aria-hidden="true" />Đăng xuất
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
