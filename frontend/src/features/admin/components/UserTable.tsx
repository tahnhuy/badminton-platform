import { useState, useEffect } from 'react';
import { MoreVertical, KeyRound, Trash2, Eye, ShieldCheck, Users } from 'lucide-react';
import type { User, PlayerProfile, CourtOwnerProfile } from '../types/user';
import { DataTable, type ColumnDef } from '@/components/common/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/empty-state';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { formatDate } from '@/shared/utils/formatDate';
import { UserStatusBadge } from './UserStatusBadge';
interface UserTableProps {
  users: User[];
  isLoading: boolean;
  selectedIds: number[];
  onSelectToggle: (id: number) => void;
  onSelectAllToggle: () => void;
  onViewDetails: (user: User) => void;
  onChangeStatus: (user: User) => void;
  onResetPassword: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export function UserTable({ users, isLoading, selectedIds, onSelectToggle, onSelectAllToggle, onViewDetails, onChangeStatus, onResetPassword, onDeleteUser }: UserTableProps) {
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  useEffect(() => { const close = () => setActiveMenu(null); window.addEventListener('scroll', close, true); window.addEventListener('resize', close); return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); }; }, []);
  const getDisplayName = (user: User) => {
    if (user.role === 'PLAYER' && user.profile && 'fullName' in user.profile) {
      return (user.profile as PlayerProfile).fullName;
    }
    if (user.role === 'COURT_OWNER' && user.profile && 'businessName' in user.profile) {
      return (user.profile as CourtOwnerProfile).businessName;
    }
    return user.email.split('@')[0];
  };

  const getSubBadge = (user: User) => {
    if (user.role === 'COURT_OWNER' && user.profile && 'businessName' in user.profile) {
      return (user.profile as CourtOwnerProfile).businessName;
    }
    return null;
  };

  const getAvatarUrl = (user: User, index: number): string => {
    if (user.role === 'PLAYER' && user.profile && 'avatarUrl' in user.profile && (user.profile as PlayerProfile).avatarUrl) {
      return (user.profile as PlayerProfile).avatarUrl || '/images/avatar_player1-56586a.png';
    }
    const fallbackAvatars = [
      '/images/avatar_player1-56586a.png',
      '/images/avatar_owner1-56586a.png',
      '/images/avatar_player2-4a0be7.png',
      '/images/avatar_owner2-6064bd.png',
      '/images/avatar_player3-7ca715.png',
    ];
    return fallbackAvatars[index % fallbackAvatars.length];
  };

  const columns: ColumnDef<User>[] = [
    {
      key: 'userInfo', header: 'NGƯỜI DÙNG / ĐỊNH DANH', minWidth: 320, render: (user, index) => {
        const isDeactivated = user.status === 'DEACTIVATED' || user.deletedAt !== null;
        const subBadge = getSubBadge(user);
        return <div className="flex items-center gap-3">
          <img alt="" src={getAvatarUrl(user, index)} className="size-11 shrink-0 rounded-full border border-border object-cover" />
          <div className="min-w-0 space-y-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">{getDisplayName(user)}{isDeactivated && <Badge>Đã vô hiệu hóa</Badge>}</p>{subBadge && <p className="text-xs text-muted-foreground">{subBadge}</p>}<p className="break-all text-sm text-muted-foreground">{user.email}</p>
            <span className="text-xs text-muted-foreground">#UID-{user.id + 10000}</span>
          </div>
        </div>;
      }
    },
    { key: 'role', header: 'VAI TRÒ', minWidth: 145, render: user => <Badge>{user.role === 'PLAYER' ? 'VĐV (Player)' : user.role === 'COURT_OWNER' ? 'Chủ sân (Owner)' : 'Quản trị viên (Admin)'}</Badge> },
    { key: 'status', header: 'TRẠNG THÁI', minWidth: 140, render: user => <UserStatusBadge status={user.status} /> },
    { key: 'createdAt', header: 'NGÀY THAM GIA', minWidth: 110, render: user => formatDate(user.createdAt) },
    {
      key: 'actions', header: 'THAO TÁC', minWidth: 180, render: user => <div className="flex items-center gap-1">
        <Button variant="ghost" onClick={() => onViewDetails(user)}>Xem chi tiết</Button>
        <DropdownMenu open={activeMenu === user.id} onOpenChange={open => setActiveMenu(open ? user.id : null)}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Thao tác với ${user.email}`}>
              <MoreVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-1000">
            <DropdownMenuItem onSelect={() => { setActiveMenu(null); onViewDetails(user); }}>
              <Eye aria-hidden="true" />Xem chi tiết</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { setActiveMenu(null); onChangeStatus(user); }}>
              <ShieldCheck aria-hidden="true" />Đổi trạng thái</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { setActiveMenu(null); onResetPassword(user); }}>
              <KeyRound aria-hidden="true" />Đặt lại mật khẩu</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => { setActiveMenu(null); onDeleteUser(user); }}>
              <Trash2 aria-hidden="true" />Xóa tài khoản</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    },
  ];
  return <DataTable<User> data={users} columns={columns} keyExtractor={u => u.id} isLoading={isLoading} selectable selectedIds={selectedIds} onSelectAll={onSelectAllToggle} onSelectItem={id => onSelectToggle(Number(id))} emptyState={<EmptyState icon={Users} title="Không tìm thấy người dùng" description="Không có tài khoản nào phù hợp với bộ lọc hoặc từ khóa tìm kiếm của bạn." />} />;
}
