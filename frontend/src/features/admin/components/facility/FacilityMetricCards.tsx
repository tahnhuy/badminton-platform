import { Building2, SquareDashed, CircleCheck, ShieldAlert } from 'lucide-react';
import type { FacilityStats } from '../../types/facility';
import { AdminMetricCard } from '../AdminMetricCard';
export function FacilityMetricCards({ stats }: { stats: FacilityStats }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <AdminMetricCard icon={Building2} label="Tổng cơ sở toàn quốc" value={stats.totalFacilities} detail={`+${stats.quarterGrowth} cơ sở quý này`} description={`Độ phủ: ${stats.provincesCovered} tỉnh/thành`} />
    <AdminMetricCard icon={SquareDashed} label="Sân thi đấu chuẩn BWF" value={stats.totalBwfCourts} detail="Grade 1 & 2" description={`${stats.yonexCount} Yonex / ${stats.pvcCount} PVC`} />
    <AdminMetricCard icon={CircleCheck} label="Cơ sở đang hoạt động" value={stats.activeFacilities} description={`Tỷ lệ mở bán: ${stats.sellingRate}%`} />
    <AdminMetricCard icon={ShieldAlert} label="Đang tạm đình chỉ" value={String(stats.suspendedFacilities).padStart(2, '0')} description="Cơ sở đang tạm dừng nhận đặt sân mới" />
  </div>;
}
