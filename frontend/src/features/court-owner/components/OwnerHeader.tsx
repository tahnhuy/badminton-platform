import { Link } from 'react-router-dom';
import { Building2, CircleUserRound, LogOut } from 'lucide-react';
import { BrandLogo } from '@/components/common/brand-logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { OwnerNavigation } from './OwnerNavigation';
import { NotificationsMenu } from '../../notifications/components/NotificationsMenu';
import type { Facility } from '../types/owner';

interface OwnerHeaderProps { query: string; email?: string; signOut: () => Promise<void>; facilities: Facility[]; facilityId: number | null; onSelectFacility: (id: number) => void }
export function OwnerHeader({ query, email, signOut, facilities, facilityId, onSelectFacility }: OwnerHeaderProps) {
  return <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
    <div className="mx-auto flex min-h-16 max-w-360 items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <Link to={`/owner${query}`} className="inline-flex shrink-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"><BrandLogo size="sm" compactOnMobile /><span className="hidden xl:inline-flex"><Badge variant="success">Chủ sân</Badge></span></Link>
      <OwnerNavigation query={query} />
      <div className="flex min-w-0 items-center gap-2">
        {facilities.length > 0 && <Select id="owner-facility" aria-label="Chọn cơ sở" leadingIcon={Building2} className="w-44 sm:w-52 xl:w-60" value={String(facilityId)} onChange={value => onSelectFacility(Number(value))} options={facilities.map(row => ({ value: String(row.id), label: row.name }))} />}
        <NotificationsMenu basePath="/owner/notifications" />
        <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="icon" className="size-11 rounded-full bg-success-bg text-primary" aria-label="Mở menu tài khoản"><CircleUserRound aria-hidden="true" className="size-6" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]"><DropdownMenuLabel><p className="font-semibold">Tài khoản Chủ sân</p><p className="max-w-64 break-all text-xs font-normal text-muted-foreground">{email}</p></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem asChild><Link to={`/owner/account${query}`}><CircleUserRound aria-hidden="true" />Thông tin tài khoản</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => void signOut()}><LogOut aria-hidden="true" />Đăng xuất</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>
    </div>
  </header>;
}
