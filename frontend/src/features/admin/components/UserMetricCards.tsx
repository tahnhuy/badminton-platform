import { Users, UserCheck, UserX, ShieldAlert } from 'lucide-react';
import { AdminMetricCard } from './AdminMetricCard';
interface UserMetricCardsProps { totalUsers?: number; activeCount?: number; suspendedCount?: number; deactivatedCount?: number }
export function UserMetricCards({ totalUsers = 10, activeCount = 8, suspendedCount = 1, deactivatedCount = 1 }: UserMetricCardsProps) {
  const activePercentage = totalUsers > 0 ? ((activeCount / totalUsers) * 100).toFixed(1) : '100.0';
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <AdminMetricCard label="Tổng người dùng" value={totalUsers.toLocaleString('vi-VN')} description="Tổng tài khoản trên hệ thống" icon={Users} />
    <AdminMetricCard label="Tài khoản hoạt động" value={activeCount.toLocaleString('vi-VN')} detail={`${activePercentage}%`} description="Trạng thái ACTIVE bình thường" icon={UserCheck} />
    <AdminMetricCard label="Đang tạm đình chỉ" value={suspendedCount.toLocaleString('vi-VN')} detail="Cần rà soát" description="Tài khoản bị tạm khóa / đình chỉ" icon={ShieldAlert} />
    <AdminMetricCard label="Đã vô hiệu hóa" value={deactivatedCount.toLocaleString('vi-VN')} detail="Soft-deleted" description="Đã vô hiệu hóa hoặc xóa mềm" icon={UserX} />
  </div>;
}
