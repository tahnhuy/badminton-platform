import { Link } from 'react-router-dom';
import { CircleUserRound, KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/common/page-layout';
import { ContentPanel } from '@/components/common/content-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../../auth/use-auth';
import { OwnerForm } from '../components/OwnerForm';
import { Feedback, ResourceState } from '../components/OwnerUi';
import { useOwnerAction } from '../hooks/useOwnerAction';
import { useOwnerResource } from '../hooks/useOwnerResource';
import { ownerApi } from '../services/owner-api';
import type { OwnerProfile } from '../types/owner';
/** Self-service contact phone: saved immediately, with no Admin review and no OTP. */
function OwnerPhoneForm({ profile, saved }: { profile: OwnerProfile; saved: () => void }) {
  const action = useOwnerAction();
  return <div className="flex flex-col gap-4 border-t border-border pt-5">
    <h3 className="text-base font-bold">Số điện thoại liên hệ</h3>
    <p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Bạn có thể tự đổi số điện thoại. Thay đổi có hiệu lực ngay, không cần Admin duyệt. Nhập 7–15 chữ số, có thể bắt đầu bằng +. Đây là số của chủ tài khoản, khác với “Điện thoại cơ sở” trong Quản lý cơ sở.</p>
    <OwnerForm key={profile.phone} fields={[{ name: 'phone', label: 'Số điện thoại', type: 'tel', required: true }]} initial={{ phone: profile.phone }} title="Lưu số điện thoại" busy={action.busy} submit={values => void action.run(() => ownerApi.write('/profile', { phone: values.phone }, 'PATCH'), saved)} />
    <Feedback {...action} />
  </div>;
}

export function OwnerAccountPage() {
  const { user, signOut } = useAuth();
  const profile = useOwnerResource<{ data: OwnerProfile }>('/profile');
  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader title="Tài khoản Chủ sân" description="Quản lý thông tin cá nhân và bảo mật tài khoản." />
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <ContentPanel title="Thông tin tài khoản" icon={CircleUserRound}>
        <p className="text-sm text-muted-foreground">Thông tin tài khoản đang đăng nhập.</p>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2"><Label htmlFor="owner-account-email">Email</Label><Input id="owner-account-email" type="email" value={user?.email ?? ''} readOnly /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="owner-account-id">Mã tài khoản</Label><Input id="owner-account-id" value={user?.id ?? ''} readOnly /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="owner-account-role">Vai trò tài khoản</Label><Input id="owner-account-role" value="Chủ sân" readOnly /></div>
        </div>
        <ResourceState {...profile} retry={profile.reload}>{profile.data && <>
          <div className="flex flex-col gap-2"><Label htmlFor="owner-account-business">Tên doanh nghiệp</Label><Input id="owner-account-business" value={profile.data.data.businessName} readOnly /></div>
          <OwnerPhoneForm profile={profile.data.data} saved={profile.reload} />
        </>}</ResourceState>
      </ContentPanel>
      <ContentPanel title="Vai trò & bảo mật" icon={ShieldCheck}>
        <div><Badge variant="success">Chủ sân</Badge></div>
        <p className="text-sm leading-6 text-muted-foreground">Quản lý cơ sở, sân, bảng giá, lịch đặt và thu nhập trong phạm vi tài khoản.</p>
        {user?.requiresPasswordChange && <p className="rounded-lg bg-caution-bg p-3 text-sm text-caution">Bạn cần cập nhật mật khẩu để bảo vệ tài khoản.</p>}
        <Button asChild variant="outline" className="h-11 self-start"><Link to="/change-password"><KeyRound aria-hidden="true" />Đổi mật khẩu</Link></Button>
        <p className="border-t border-border pt-4 text-sm leading-6 text-muted-foreground">Cần hỗ trợ? Liên hệ quản trị viên qua kênh hỗ trợ của nền tảng.</p>
        <Button type="button" variant="danger-soft" className="h-11 self-start" onClick={() => void signOut()}><LogOut aria-hidden="true" />Đăng xuất</Button>
      </ContentPanel>
    </div>
  </div>;
}
