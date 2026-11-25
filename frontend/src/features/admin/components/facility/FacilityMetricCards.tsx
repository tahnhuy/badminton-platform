import { Building2, SquareDashed, CircleCheck, ShieldAlert } from 'lucide-react';
import type { FacilityStats } from '../../types/facility';
import { AdminMetricCard } from '../AdminMetricCard';
export function FacilityMetricCards({ stats }: { stats: FacilityStats }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <AdminMetricCard icon={Building2} label="Tổng cơ sở toàn quốc" value={stats.totalFacilities} detail={`+${stats.newFacilitiesThisQuarter} cơ sở quý này`} description={`Độ phủ: ${stats.provincesCovered} tỉnh/thành · Không gồm cơ sở đã vô hiệu hóa · Bản ghi nhập mẫu chưa xác nhận: ${stats.unconfirmedSampleFacilities}`} />
    <AdminMetricCard icon={SquareDashed} label="Tổng số sân" value={stats.totalActiveCourts} detail="sân đang hoạt động" description="Chỉ đếm sân ACTIVE thuộc cơ sở đang hoạt động" />
    <AdminMetricCard icon={CircleCheck} label="Cơ sở đang hoạt động" value={stats.activeFacilities} description={`Tỷ lệ cơ sở hoạt động: ${stats.activeFacilityRate}%`} />
    <AdminMetricCard icon={ShieldAlert} label="Đang tạm đình chỉ" value={String(stats.suspendedFacilities).padStart(2, '0')} description="Không gồm cơ sở đã vô hiệu hóa" />
  </div>;
}
