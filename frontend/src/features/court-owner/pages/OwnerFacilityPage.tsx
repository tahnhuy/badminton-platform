import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DataTable } from '@/components/common/data-table';
import { Building2, MapPin, RefreshCw, SquareDashed } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
import { PageHeader } from '@/components/common/page-layout';
import { Button } from '@/components/ui/button';
import { useOwnerWorkspace } from '../hooks/owner-workspace';
import { useOwnerResource } from '../hooks/useOwnerResource';
import { Feedback, ResourceState, Status } from '../components/OwnerUi';
import { useOwnerAction } from '../hooks/useOwnerAction';
import { OwnerForm } from '../components/OwnerForm';
import { metadataFields, locationFields, courtFields } from '../components/owner-fields';
import { ReviewPanel } from '../components/ReviewPanel';
import { CreateFacilityPanel } from '../components/CreateFacilityPanel';
import { ownerApi } from '../services/owner-api';
import type { Facility } from '../types/owner';
function FacilityEditors({ facility, reload }: { facility: Facility; reload: () => void }) {
  const action = useOwnerAction();
  const rejected = facility.status === 'REJECTED';
  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"><ContentPanel title="Thông tin cơ sở" icon={Building2}><p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Đổi giờ sẽ bị từ chối nếu ảnh hưởng booking còn hiệu lực. Địa chỉ đã được duyệt chỉ thay đổi sau khi Admin duyệt đề xuất.</p>
    <OwnerForm key={facility.updatedAt} fields={rejected ? [...metadataFields, ...locationFields] : metadataFields} initial={{ ...facility }} title="Lưu thông tin cơ sở" busy={action.busy} disabled={facility.status === 'PENDING_APPROVAL'} submit={values => void action.run(() => ownerApi.write(`/facilities/${facility.id}`, values, 'PUT'), reload)} />
    {rejected && <Button type="button" variant="outline" className="h-11" onClick={() => void action.run(() => ownerApi.write(`/facilities/${facility.id}/resubmit`, {}), reload)} disabled={action.busy}>Gửi lại hồ sơ cơ sở</Button>}<Feedback {...action} /></ContentPanel>
    <aside className="min-w-0"><ContentPanel title="Địa chỉ đã lưu" icon={MapPin}><p>{[facility.address, facility.ward, facility.district, facility.city].filter(Boolean).join(', ')}</p><p>Tọa độ: {facility.latitude}, {facility.longitude}</p>
      {facility.pendingAddressReview && <p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Địa chỉ chờ duyệt: {String(facility.pendingAddressReview.submittedValues.address)}</p>}
      {['ACTIVE', 'SUSPENDED'].includes(facility.status) && <><h3 className="border-t border-border pt-4 text-base font-bold">Gửi đề xuất địa chỉ</h3><OwnerForm fields={locationFields} initial={{ ...facility }} title="Gửi đề xuất địa chỉ" disabled={!!facility.pendingAddressReview} busy={action.busy} submit={values => void action.run(() => ownerApi.write(`/facilities/${facility.id}/address-change-requests`, values), reload)} /></>}
    </ContentPanel></aside></div>;
}
function CourtManagement({ facility, reload }: { facility: Facility; reload: () => void }) {
  const [search, setSearch] = useSearchParams();
  const courtParam = search.get('courtId');
  const [editingId, setEditingId] = useState<number | null>(null);
  const editing = facility.courts?.find(court => court.id === editingId) ?? null;
  const action = useOwnerAction();
  const selectCourt = (id: number | null) => {
    setEditingId(id);
    const next = new URLSearchParams(search);
    if (id === null) next.delete('courtId');
    else next.set('courtId', String(id));
    setSearch(next, { replace: true });
  };
  useEffect(() => {
    const id = Number(courtParam);
    if (!courtParam) { setEditingId(null); return; }
    setEditingId(Number.isSafeInteger(id) && id > 0 && facility.courts?.some(court => court.id === id) ? id : null);
  }, [courtParam, facility.courts]);
  const save = (values: Record<string, unknown>) => void action.run(() => editing ? ownerApi.write(`/courts/${editing.id}`, values, 'PUT') : ownerApi.write(`/facilities/${facility.id}/courts`, values), () => { selectCourt(null); reload(); });
  return <ContentPanel title="Danh sách sân" icon={SquareDashed}><DataTable scrollable data={facility.courts ?? []} keyExtractor={row => row.id} emptyState={<p>Chưa có sân. Thêm sân để gửi Admin duyệt.</p>} columns={[
    { key: 'name', header: 'Tên sân', minWidth: 180, render: row => row.name }, { key: 'description', header: 'Mô tả', minWidth: 240, render: row => row.description || 'Chưa có mô tả' },
    { key: 'status', header: 'Trạng thái', minWidth: 160, render: row => <Status value={row.status} /> },
    { key: 'actions', header: 'Thao tác', minWidth: 320, render: row => <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" className="h-11" onClick={() => selectCourt(row.id)}>Chi tiết / Sửa sân</Button>{row.status === 'REJECTED' && <Button type="button" variant="outline" className="h-11" disabled={action.busy} onClick={() => void action.run(() => ownerApi.write(`/courts/${row.id}/resubmit`, {}), reload)}>Gửi lại sân</Button>}</div> },
  ]} />
    <h3 className="border-t border-border pt-4 text-base font-bold">{editing ? `Sửa sân: ${editing.name}` : 'Thêm sân mới'}</h3><OwnerForm key={editing?.id ?? `new-${facility.courts?.length}`} fields={courtFields} initial={editing ? { ...editing } : {}} title={editing ? 'Lưu thông tin sân' : 'Gửi sân để duyệt'} busy={action.busy} disabled={editing?.status === 'PENDING_APPROVAL'} submit={save} />
    {editing && <><Button type="button" variant="outline" className="h-11" onClick={() => selectCourt(null)}>Thêm sân khác</Button><ReviewPanel key={editing.id} path={`/courts/${editing.id}/reviews`} /></>}<Feedback {...action} />
  </ContentPanel>;
}
export function OwnerFacilityPage() {
  const workspace = useOwnerWorkspace();
  const resource = useOwnerResource<{ data: Facility }>(workspace.facilityId ? `/facilities/${workspace.facilityId}` : null, true);
  const reload = () => { resource.reload(); workspace.refresh(); };
  return <div className="flex min-w-0 flex-col gap-6"><PageHeader title="Quản lý cơ sở" /><CreateFacilityPanel />{!workspace.facilityId && <p>Bạn chưa có cơ sở.</p>}
    <ResourceState {...resource} retry={reload}>{resource.data && <><div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-bold tracking-tight">{resource.data.data.name}</h2><Status value={resource.data.data.status} /><Button type="button" variant="outline" className="h-11" onClick={reload}><RefreshCw aria-hidden="true" />Làm mới cơ sở</Button></div>
      <FacilityEditors facility={resource.data.data} reload={reload} /><CourtManagement facility={resource.data.data} reload={reload} /><ReviewPanel path={`/facilities/${workspace.facilityId}/reviews`} />
    </>}</ResourceState></div>;
}
