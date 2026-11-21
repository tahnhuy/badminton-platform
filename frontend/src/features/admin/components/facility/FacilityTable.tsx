import { Link } from 'react-router-dom';
import { Building2, Ban, CheckCheck, Trash2 } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Badge } from '@/components/ui/badge';
import type { Facility } from '../../types/facility';
interface FacilityTableProps { facilities: Facility[]; isLoading: boolean; onOpenStatusModal: (facility: Facility, targetStatus: 'ACTIVE' | 'SUSPENDED') => void; onDeleteFacility: (facility: Facility) => void; filterSummaryText?: string }
export function FacilityTable({ facilities, isLoading, onOpenStatusModal, onDeleteFacility, filterSummaryText }: FacilityTableProps) {
  if (isLoading) return <div role="status" className="space-y-3">
    <p className="text-sm text-muted-foreground">Đang tải danh sách cơ sở...</p>{[0, 1, 2].map(i =>
      <Skeleton key={i} className="h-20 w-full" />)}</div>;
  if (facilities.length === 0) return <EmptyState icon={Building2} title="Không tìm thấy cơ sở nào" description="Vui lòng điều chỉnh hoặc đặt lại bộ lọc tìm kiếm." />;
  const columns: ColumnDef<Facility>[] = [
    {
key: 'facility', header: 'CƠ SỞ / CỤM SÂN', minWidth: 280, render: facility =>
        <div className="space-y-1">
          <p className="font-bold">{facility.name}</p>
          <p className="text-xs font-semibold text-primary">{facility.facilityCode}</p>
          <p className="text-sm text-muted-foreground">{facility.address}, {facility.city}</p>
          <Link className={buttonVariants({ variant: 'ghost', className: 'mt-1 px-0 text-primary' })} to={`/admin/courts/${facility.id}/reviews`}>Hồ sơ duyệt</Link>
        </div>
},
    {
key: 'owner', header: 'CHỦ SỞ HỮU & LIÊN HỆ', minWidth: 210, render: f =>
        <div className="space-y-1">
          <p className="font-semibold">{f.owner.name}</p>
          <p>{f.owner.phone}</p>
          <p className="break-all text-muted-foreground">{f.owner.email}</p>
        </div>
},
    {
key: 'scale', header: 'QUY MÔ & LOẠI THẢM', minWidth: 160, render: f =>
        <div>
          <p className="font-bold">{f.courtStats.totalCourts} sân đạt chuẩn</p>
          <p className="text-sm text-muted-foreground">{f.courtStats.surfaceSummary}</p>
        </div>
},
    {
key: 'grade', header: 'TIÊU CHUẨN BWF', minWidth: 180, render: f =>
        <Badge>{(f.grade || '').includes('Grade 1') ? 'BWF Grade 1 Hub' : (f.grade || '').includes('Grade 2') ? 'BWF Grade 2' : 'Tiêu chuẩn phong trào'}</Badge>
},
    {
key: 'status', header: 'TRẠNG THÁI VẬN HÀNH', minWidth: 180, render: f =>
        <div className="space-y-2">
          <Badge variant={f.status === 'ACTIVE' ? 'success' : 'neutral'}>{f.status}</Badge>{f.deletedAt !== null && <Badge>Đã vô hiệu hóa</Badge>}<p className="text-xs text-muted-foreground">{f.statusNote}</p>
        </div>
},
    {
key: 'actions', header: 'THAO TÁC', width: 1, headerClassName: 'whitespace-nowrap text-right', className: 'whitespace-nowrap', render: facility => {
const isSuspended = facility.status === 'SUSPENDED' || facility.deletedAt !== null; return <div className="flex items-center justify-end gap-2">{isSuspended ? <>
          <Button variant="outline" onClick={() => onOpenStatusModal(facility, 'ACTIVE')}>
            <CheckCheck aria-hidden="true" />Thẩm định lại</Button>
          <Button variant="danger-soft" size="icon" aria-label="Xóa / Vô hiệu hóa cơ sở" title="Xóa / Vô hiệu hóa cơ sở" onClick={() => onDeleteFacility(facility)}>
            <Trash2 aria-hidden="true" />
          </Button>
        </> : <Button variant="danger-soft" size="icon" title="Tạm đình chỉ cơ sở" aria-label="Tạm đình chỉ cơ sở" onClick={() => onOpenStatusModal(facility, 'SUSPENDED')}>
          <Ban aria-hidden="true" />
        </Button>}</div>;
}
},
  ];
  return <section className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-lg font-bold">Danh sách đối tác cụm sân</h2>
      <p className="text-sm text-muted-foreground">{filterSummaryText || `Hiển thị ${facilities.length} cụm sân`}</p>
    </div>
    <DataTable data={facilities} columns={columns} keyExtractor={f => f.id} />
  </section>;
}
