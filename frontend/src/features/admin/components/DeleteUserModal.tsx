import { AdminDialog, AdminDialogFooter } from './AdminDialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import React, { useState } from 'react';
import type { User } from '../types/user';

interface DeleteUserModalProps {
  user: User | null;
  onClose: () => void;
  onConfirm: (userId: number) => Promise<void>;
}

export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  user,
  onClose,
  onConfirm,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const isAdmin = user.role === 'ADMIN';

  const handleDelete = async () => {
    if (isAdmin) {
      setError('Quy tắc hệ thống: Không thể xóa tài khoản Quản trị viên (Admin).');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(user.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa tài khoản');
    } finally {
      setIsSubmitting(false);
    }
  };


  return <AdminDialog open={Boolean(user)} onClose={onClose} title="Xác nhận xóa tài khoản">
    <p className="break-words text-sm leading-6">Bạn có chắc chắn muốn xóa tài khoản <strong>{user.email}</strong> (#UID-{user.id + 10000}) không?</p>
    <Alert className="mt-4" variant="warning">Tài khoản sẽ được chuyển sang trạng thái <strong>Soft Delete</strong> để bảo toàn tính toàn vẹn dữ liệu lịch sử đặt sân và giải đấu.</Alert>
    {error && <Alert className="mt-4" variant="destructive">{error}</Alert>}
    <AdminDialogFooter>
      <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
      <Button type="button" variant="danger" onClick={handleDelete} disabled={isSubmitting || isAdmin}>{isSubmitting ? 'Đang xóa...' : 'Xóa tài khoản'}</Button>
    </AdminDialogFooter>
  </AdminDialog>;
};
