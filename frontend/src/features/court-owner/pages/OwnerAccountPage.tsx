import { Link } from 'react-router-dom';
import { CircleUserRound, KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/common/page-layout';
import { ContentPanel } from '@/components/common/content-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../../auth/use-auth';

export function OwnerAccountPage() {
  const { user, signOut } = useAuth();
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
