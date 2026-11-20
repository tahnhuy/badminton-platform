import { AdminDialog, AdminDialogFooter } from './AdminDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import React, { useState } from 'react';
import type { User } from '../types/user';

interface ResetPasswordModalProps {
  user: User | null;
  onClose: () => void;
  onConfirm: (userId: number, newPassword: string) => Promise<void>;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  user,
  onClose,
  onConfirm,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(user.id, password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đặt lại mật khẩu');
    } finally {
      setIsSubmitting(false);
    }
  };


  return <AdminDialog open={Boolean(user)} onClose={onClose} title="Đặt lại mật khẩu" description={<>Thiết lập mật khẩu trực tiếp cho tài khoản <strong>{user.email}</strong>.</>}>
    <form onSubmit={handleSubmit} className="space-y-4">{error && <Alert variant="destructive">{error}</Alert>}
      <label className="block space-y-2 text-sm font-semibold">Mật khẩu mới<Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nhập tối thiểu 6 ký tự..." required />
      </label>
      <label className="block space-y-2 text-sm font-semibold">Xác nhận mật khẩu mới<Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu..." required />
      </label>
      <AdminDialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}</Button>
      </AdminDialogFooter>
    </form>
  </AdminDialog>;
};
