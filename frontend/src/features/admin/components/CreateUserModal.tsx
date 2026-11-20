import { AdminDialog, AdminDialogFooter } from './AdminDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/shared/utils/cn';
import React, { useState } from 'react';
import type { UserRole, UserStatus, CreateUserPayload } from '../types/user';

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
  const [role, setRole] = useState<UserRole>('PLAYER');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [skillLevelId, setSkillLevelId] = useState<number>(2); // Default Intermediate
  const [avatarUrl, setAvatarUrl] = useState('/images/avatar_player1-56586a.png');
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

    if (role === 'PLAYER' && !fullName.trim()) {
      setError('Vui lòng nhập họ và tên VĐV.');
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
        fullName: role === 'PLAYER' ? fullName.trim() : undefined,
        skillLevelId: role === 'PLAYER' ? skillLevelId : undefined,
        avatarUrl: role === 'PLAYER' ? avatarUrl : undefined,
        businessName: role === 'COURT_OWNER' ? businessName.trim() : undefined,
        phone: role === 'COURT_OWNER' ? phone.trim() : undefined,
      });
      // Reset form
      setEmail('');
      setPassword('');
      setFullName('');
      setBusinessName('');
      setPhone('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo người dùng.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return <AdminDialog open={isOpen} onClose={onClose} title="Thêm người dùng mới" description="Tạo tài khoản VĐV, Chủ sân hoặc Quản trị viên">
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <Alert variant="destructive">{error}</Alert>}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Vai trò hệ thống *</legend>
        <div className="flex flex-wrap gap-2">
          {[{ id: 'PLAYER', label: 'VĐV (Player)' }, { id: 'COURT_OWNER', label: 'Chủ sân (Owner)' }, { id: 'ADMIN', label: 'Quản trị viên' }].map(item => <Button key={item.id} type="button" variant={role === item.id ? 'brand' : 'outline'} aria-pressed={role === item.id} onClick={() => setRole(item.id as UserRole)}>{item.label}</Button>)}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold">Email đăng nhập *<Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vd: athlete@example.com" />
        </label>
        <label className="space-y-2 text-sm font-semibold">Mật khẩu khởi tạo *<Input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" />
        </label>
      </div>
      {role === 'PLAYER' && <>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold">Họ và tên VĐV *<Input required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="vd: Nguyễn Văn Nam" />
          </label>
          <label className="space-y-2 text-sm font-semibold">Trình độ kỹ năng<NativeSelect value={skillLevelId} onChange={e => setSkillLevelId(Number(e.target.value))}>
            <option value={1}>Mới chơi (Beginner)</option>
            <option value={2}>Trung bình (Intermediate)</option>
            <option value={3}>Khá / Bán chuyên (Advanced)</option>
            <option value={4}>Chuyên nghiệp (PRO)</option>
          </NativeSelect>
          </label>
        </div>
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Chọn Avatar mẫu</legend>
          <div className="flex flex-wrap gap-3">{['/images/avatar_player1-56586a.png', '/images/avatar_player2-4a0be7.png', '/images/avatar_player3-7ca715.png', '/images/avatar_owner1-56586a.png'].map((url, i) => <button key={url} type="button" aria-label={`Avatar ${i + 1}`} aria-pressed={avatarUrl === url} onClick={() => setAvatarUrl(url)} className={cn('size-14 rounded-full border-2 p-1 outline-none focus-visible:ring-4 focus-visible:ring-ring/20', avatarUrl === url ? 'border-primary bg-accent' : 'border-transparent')}>
            <img src={url} alt="" className="size-full rounded-full object-cover" />
          </button>)}</div>
        </fieldset>
      </>}
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
