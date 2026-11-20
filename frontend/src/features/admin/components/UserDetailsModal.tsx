import { AdminDialog, AdminDialogFooter } from './AdminDialog';
import { Button } from '@/components/ui/button';
import { DetailRow } from '@/components/common/content-panel';
import { UserStatusBadge } from './UserStatusBadge';
import React from 'react';
import type { User, PlayerProfile, CourtOwnerProfile } from '../types/user';
import { formatDate } from '../../../shared/utils/formatDate';
import { UserRatingsPanels } from '../../ratings/components/UserRatingsPanels';

interface UserDetailsModalProps {
  user: User | null;
  onClose: () => void;
  onEditStatus: (user: User) => void;
  onResetPassword: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  user,
  onClose,
  onEditStatus,
  onResetPassword,
  onDeleteUser,
}) => {

  if (!user) return null;

  const isPlayer = user.role === 'PLAYER';
  const isOwner = user.role === 'COURT_OWNER';
  const playerProfile = isPlayer ? (user.profile as PlayerProfile) : null;
  const ownerProfile = isOwner ? (user.profile as CourtOwnerProfile) : null;

  const displayName = playerProfile?.fullName || ownerProfile?.businessName || user.email;

  return <AdminDialog open={Boolean(user)} onClose={onClose} title="Chi tiết hồ sơ người dùng" description={`Mã định danh: #UID-${user.id + 10000}`}>
    <div className="flex min-w-0 items-center gap-4 rounded-2xl bg-accent p-4">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">{displayName.charAt(0).toUpperCase()}</span>
      <div className="min-w-0">
        <h3 className="break-words text-lg font-bold">{displayName}</h3>
        <p className="break-all text-sm text-muted-foreground">{user.email}</p>
        <UserStatusBadge status={user.status} />
      </div>
    </div>
    <div className="my-4">
      <DetailRow label="VAI TRÒ" value={user.role} />
      <DetailRow label="NGÀY THAM GIA" value={formatDate(user.createdAt)} />
      {isPlayer && <DetailRow label="TRÌNH ĐỘ" value={`Cấp ${playerProfile?.skillLevelId || 1}`} />}
      {isOwner && <DetailRow label="SỐ ĐIỆN THOẠI" value={ownerProfile?.phone || 'N/A'} />}
    </div>{isPlayer && <UserRatingsPanels userId={user.id} />}
    <AdminDialogFooter>{user.role !== 'ADMIN' && <Button variant="danger-soft" onClick={() => { onClose(); onDeleteUser(user); }}>Xóa tài khoản</Button>}
      <Button variant="outline" onClick={() => { onClose(); onResetPassword(user); }}>Đặt lại mật khẩu</Button>
      <Button onClick={() => { onClose(); onEditStatus(user); }}>Đổi trạng thái</Button>
    </AdminDialogFooter>
  </AdminDialog>;
};
