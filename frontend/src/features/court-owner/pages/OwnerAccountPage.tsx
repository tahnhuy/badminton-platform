import { Link } from 'react-router-dom';
import { CircleUserRound, KeyRound, LogOut } from 'lucide-react';
import { PageHeader } from '@/components/common/page-layout';
import { ContentPanel, DetailRow } from '@/components/common/content-panel';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../auth/use-auth';
export function OwnerAccountPage() {
  const { user, signOut } = useAuth();
  return <div className="flex min-w-0 flex-col gap-6"><PageHeader title="Tài khoản Chủ sân" /><ContentPanel title="Thông tin tài khoản" icon={CircleUserRound} className="max-w-3xl">
    <div><DetailRow label="Email" value={user?.email} /><DetailRow label="Vai trò" value="Chủ sân" /></div>
    <div className="flex flex-wrap gap-3 border-t border-border pt-4"><Button asChild variant="outline" className="h-11"><Link to="/change-password"><KeyRound aria-hidden="true" />Đổi mật khẩu</Link></Button><Button type="button" variant="danger-soft" className="h-11" onClick={() => void signOut()}><LogOut aria-hidden="true" />Đăng xuất</Button></div>
  </ContentPanel></div>;
}
