import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AdminDialog, AdminDialogFooter } from './AdminDialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import React, { useState } from 'react';
import type { User, UserStatus } from '../types/user';

interface UserStatusModalProps {
  user: User | null;
  onClose: () => void;
  onConfirm: (userId: number, newStatus: UserStatus) => Promise<void>;
}

export const UserStatusModal: React.FC<UserStatusModalProps> = ({
  user,
  onClose,
  onConfirm,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<UserStatus>(user?.status ?? 'ACTIVE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      setSelectedStatus(user.status);
      setError(null);
    }
  }, [user]);

  if (!user) return null;

  const isAdmin = user.role === 'ADMIN';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdmin && (selectedStatus === 'SUSPENDED' || selectedStatus === 'DEACTIVATED')) {
      setError('Quy tắc hệ thống: Không thể đình chỉ hoặc vô hiệu hóa tài khoản Quản trị viên (Admin).');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(user.id, selectedStatus);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật trạng thái');
    } finally {
      setIsSubmitting(false);
    }
  };


  return <AdminDialog open={Boolean(user)} onClose={onClose} title="Thay đổi trạng thái tài khoản" description={<>Cập nhật trạng thái hoạt động cho tài khoản <strong>{user.email}</strong>.</>}>
    <form onSubmit={handleSubmit} className="space-y-4">{error && <Alert variant="destructive">{error}</Alert>}
      <RadioGroup value={selectedStatus} onValueChange={value => setSelectedStatus(value as UserStatus)} aria-label="Trạng thái tài khoản">
        {[
          { value: 'ACTIVE', label: 'ACTIVE (Hoạt động)', description: 'Tài khoản được phép đăng nhập và sử dụng đầy đủ tính năng nền tảng.' },
          { value: 'SUSPENDED', label: 'SUSPENDED (Tạm đình chỉ)', description: 'Tài khoản bị tạm khóa do vi phạm điều lệ giải đấu hoặc quy tắc cộng đồng.' },
          { value: 'DEACTIVATED', label: 'DEACTIVATED (Vô hiệu hóa)', description: 'Vô hiệu hóa vĩnh viễn quyền truy cập của người dùng trên toàn hệ thống.' },
        ].map(item => <label key={item.value} className="flex min-h-16 items-start gap-3 rounded-lg border border-border p-4 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent">
          <RadioGroupItem className="mt-1" value={item.value} disabled={isAdmin && item.value !== 'ACTIVE'} />
          <span>
            <span className="block text-sm font-semibold">{item.label}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{item.description}</span>
          </span>
        </label>)}
      </RadioGroup>
      <AdminDialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</Button>
      </AdminDialogFooter>
    </form>
  </AdminDialog>;
};
