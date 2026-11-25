import { AdminDialog, AdminDialogFooter } from './AdminDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import React, { useState } from 'react';
import { Copy, KeyRound } from 'lucide-react';
import type { User } from '../types/user';

interface ResetPasswordModalProps {
  user: User | null;
  onClose: () => void;
  onConfirm: (userId: number, reason: string) => Promise<string>;
}

/**
 * Admin password reset (email OTP plan §3.5): the Admin supplies a reason, the
 * server generates the temporary password, and it is shown exactly once.
 */
export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ user, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do cấp lại mật khẩu.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      const password = await onConfirm(user.id, reason.trim());
      setTemporaryPassword(password);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cấp lại mật khẩu');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPassword = async () => {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
    } catch {
      setError('Không thể copy. Vui lòng chọn và copy thủ công.');
    }
  };

  return <AdminDialog
    open={Boolean(user)}
    onClose={onClose}
    title={temporaryPassword ? 'Mật khẩu tạm đã được tạo' : 'Cấp lại mật khẩu'}
    description={temporaryPassword
      ? <>Bàn giao mật khẩu tạm cho <strong>{user.email}</strong> qua kênh đã xác minh. Mật khẩu không được gửi qua email và sẽ không hiển thị lại.</>
      : <>Hệ thống sinh mật khẩu tạm cho <strong>{user.email}</strong>. Người dùng phải đổi mật khẩu sau khi đăng nhập.</>}
  >
    {temporaryPassword ? <div className="space-y-4">
      <Alert variant="warning">Chỉ hiển thị một lần. Nếu mất, hãy cấp lại mật khẩu.</Alert>
      <label className="block space-y-2 text-sm font-semibold">Mật khẩu tạm
        <div className="flex gap-2">
          <Input readOnly value={temporaryPassword} aria-label="Mật khẩu tạm" className="font-mono" />
          <Button type="button" variant="outline" onClick={() => void copyPassword()}><Copy aria-hidden="true" />{copied ? 'Đã copy' : 'Copy'}</Button>
        </div>
      </label>
      <AdminDialogFooter>
        <Button type="button" onClick={onClose}>Đã bàn giao, đóng</Button>
      </AdminDialogFooter>
    </div> : <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      <label className="block space-y-2 text-sm font-semibold">Lý do cấp lại mật khẩu
        <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ví dụ: chủ tài khoản yêu cầu qua hotline" maxLength={500} required />
      </label>
      <AdminDialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
        <Button type="submit" disabled={isSubmitting}><KeyRound aria-hidden="true" />{isSubmitting ? 'Đang tạo...' : 'Cấp lại mật khẩu'}</Button>
      </AdminDialogFooter>
    </form>}
  </AdminDialog>;
};
