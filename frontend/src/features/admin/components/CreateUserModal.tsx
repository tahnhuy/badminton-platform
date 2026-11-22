import { AdminDialog, AdminDialogFooter } from './AdminDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Alert } from '@/components/ui/alert';
import React, { useState } from 'react';
import type { CreatableUserRole, UserStatus, CreateUserPayload } from '../types/user';

/** Players are not created here: they register with the skill survey (AUTH-33). */
const ROLE_OPTIONS: Array<{ id: CreatableUserRole; label: string }> = [
  { id: 'COURT_OWNER', label: 'Chủ sân (Owner)' },
  { id: 'ADMIN', label: 'Quản trị viên' },
];

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newUser: any) => void;
  onSubmit: (payload: CreateUserPayload) => Promise<void>;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<CreatableUserRole>('COURT_OWNER');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Vui lòng nhập email hợp lệ.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.');
      return;
    }

    if (role === 'COURT_OWNER') {
      if (!businessName.trim()) {
        setError('Vui lòng nhập tên sân / câu lạc bộ.');
        return;
      }
      if (!phone.trim()) {
        setError('Vui lòng nhập số điện thoại liên hệ.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        email: email.trim().toLowerCase(),
        password,
        role,
        status,
        businessName: role === 'COURT_OWNER' ? businessName.trim() : undefined,
        phone: role === 'COURT_OWNER' ? phone.trim() : undefined,
      });
      // Reset form
      setEmail('');
      setPassword('');
      setBusinessName('');
      setPhone('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo người dùng.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return <AdminDialog open={isOpen} onClose={onClose} title="Thêm người dùng mới" description="Tạo tài khoản Chủ sân hoặc Quản trị viên. Người chơi tự đăng ký kèm khảo sát trình độ.">
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <Alert variant="destructive">{error}</Alert>}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Vai trò hệ thống *</legend>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map(item => <Button key={item.id} type="button" variant={role === item.id ? 'brand' : 'outline'} aria-pressed={role === item.id} onClick={() => setRole(item.id)}>{item.label}</Button>)}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold">Email đăng nhập *<Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vd: owner@example.com" />
        </label>
        <label className="space-y-2 text-sm font-semibold">Mật khẩu khởi tạo *<Input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" />
        </label>
      </div>
      {role === 'COURT_OWNER' && <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold">Tên Sân / CLB *<Input required value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="vd: CLB Cầu Lông Tân Bình" />
        </label>
        <label className="space-y-2 text-sm font-semibold">Số điện thoại *<Input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="vd: 0901234567" />
        </label>
      </div>}
      <label className="block space-y-2 text-sm font-semibold">Trạng thái tài khoản ban đầu<NativeSelect value={status} onChange={e => setStatus(e.target.value as UserStatus)}>
        <option value="ACTIVE">Hoạt động (ACTIVE)</option>
        <option value="SUSPENDED">Tạm đình chỉ (SUSPENDED)</option>
        <option value="DEACTIVATED">Vô hiệu hóa (DEACTIVATED)</option>
      </NativeSelect>
      </label>
      <AdminDialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang tạo...' : '+ Tạo người dùng'}</Button>
      </AdminDialogFooter>
    </form>
  </AdminDialog>;
};
