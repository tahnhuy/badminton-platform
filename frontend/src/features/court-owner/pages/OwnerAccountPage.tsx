import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/use-auth';
export function OwnerAccountPage() {
  const { user, signOut } = useAuth();
  return <><h1>Tài khoản Chủ sân</h1><section className="owner-card"><h2>Thông tin tài khoản</h2><p>Email: {user?.email}</p><p>Vai trò: Chủ sân</p><div className="owner-actions"><Link to="/change-password">Đổi mật khẩu</Link><button onClick={() => void signOut()}>Đăng xuất</button></div></section></>;
}
