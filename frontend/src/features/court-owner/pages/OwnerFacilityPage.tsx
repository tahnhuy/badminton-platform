import { useState } from 'react';
import { DataTable } from '../../../components/common/DataTable';
import { useOwnerWorkspace } from '../hooks/owner-workspace';
import { useOwnerResource } from '../hooks/useOwnerResource';
import { Feedback, ResourceState, Status } from '../components/OwnerUi';
import { useOwnerAction } from '../hooks/useOwnerAction';
import { OwnerForm } from '../components/OwnerForm';
import { metadataFields, locationFields, courtFields } from '../components/owner-fields';
import { ReviewPanel } from '../components/ReviewPanel';
import { CreateFacilityPanel } from './OwnerDashboard';
import { ownerApi } from '../services/owner-api';
import type { Facility } from '../types/owner';
function FacilityEditors({ facility, reload }: { facility: Facility; reload: () => void }) {
  const action = useOwnerAction();
  const rejected = facility.status === 'REJECTED';
  return <div className="owner-columns"><section className="owner-card"><h2>Thông tin cơ sở</h2><p className="owner-note">Đổi giờ sẽ bị từ chối nếu ảnh hưởng booking còn hiệu lực. Địa chỉ đã được duyệt chỉ thay đổi sau khi Admin duyệt đề xuất.</p>
    <OwnerForm key={facility.updatedAt} fields={rejected ? [...metadataFields, ...locationFields] : metadataFields} initial={{ ...facility }} title="Lưu thông tin cơ sở" busy={action.busy} disabled={facility.status === 'PENDING_APPROVAL'} submit={values => void action.run(() => ownerApi.write(`/facilities/${facility.id}`, values, 'PUT'), reload)} />
    {rejected && <button onClick={() => void action.run(() => ownerApi.write(`/facilities/${facility.id}/resubmit`, {}), reload)} disabled={action.busy}>Gửi lại hồ sơ cơ sở</button>}<Feedback {...action} /></section>
    <aside className="owner-aside"><section className="owner-card"><h2>Địa chỉ đã lưu</h2><p>{[facility.address, facility.ward, facility.district, facility.city].filter(Boolean).join(', ')}</p><p>Tọa độ: {facility.latitude}, {facility.longitude}</p>
      {facility.pendingAddressReview && <p className="owner-note">Địa chỉ chờ duyệt: {String(facility.pendingAddressReview.submittedValues.address)}</p>}
      {['ACTIVE', 'SUSPENDED'].includes(facility.status) && <><h3>Gửi đề xuất địa chỉ</h3><OwnerForm fields={locationFields} initial={{ ...facility }} title="Gửi đề xuất địa chỉ" disabled={!!facility.pendingAddressReview} busy={action.busy} submit={values => void action.run(() => ownerApi.write(`/facilities/${facility.id}/address-change-requests`, values), reload)} /></>}
    </section></aside></div>;
}
function CourtManagement({ facility, reload }: { facility: Facility; reload: () => void }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const editing = facility.courts?.find(court => court.id === editingId) ?? null;
  const action = useOwnerAction();
  const save = (values: Record<string, unknown>) => void action.run(() => editing ? ownerApi.write(`/courts/${editing.id}`, values, 'PUT') : ownerApi.write(`/facilities/${facility.id}/courts`, values), () => { setEditingId(null); reload(); });
  return <section className="owner-card"><h2>Danh sách sân</h2><DataTable data={facility.courts ?? []} keyExtractor={row => row.id} emptyState={<p>Chưa có sân. Thêm sân để gửi Admin duyệt.</p>} columns={[
    { key: 'name', header: 'Tên sân', render: row => row.name }, { key: 'status', header: 'Trạng thái', render: row => <Status value={row.status} /> },
    { key: 'actions', header: 'Thao tác', render: row => <div className="owner-actions"><button onClick={() => setEditingId(row.id)}>Chi tiết / Sửa sân</button>{row.status === 'REJECTED' && <button disabled={action.busy} onClick={() => void action.run(() => ownerApi.write(`/courts/${row.id}/resubmit`, {}), reload)}>Gửi lại sân</button>}</div> },
  ]} />
    <h3>{editing ? `Sửa sân: ${editing.name}` : 'Thêm sân mới'}</h3><OwnerForm key={editing?.id ?? `new-${facility.courts?.length}`} fields={courtFields} initial={editing ? { ...editing } : {}} title={editing ? 'Lưu thông tin sân' : 'Gửi sân để duyệt'} busy={action.busy} disabled={editing?.status === 'PENDING_APPROVAL'} submit={save} />
    {editing && <><button onClick={() => setEditingId(null)}>Thêm sân khác</button><ReviewPanel key={editing.id} path={`/courts/${editing.id}/reviews`} /></>}<Feedback {...action} />
  </section>;
}
export function OwnerFacilityPage() {
  const workspace = useOwnerWorkspace();
  const resource = useOwnerResource<{ data: Facility }>(workspace.facilityId ? `/facilities/${workspace.facilityId}` : null, true);
  const reload = () => { resource.reload(); workspace.refresh(); };
  return <><h1>Quản lý cơ sở</h1><CreateFacilityPanel />{!workspace.facilityId && <p>Bạn chưa có cơ sở.</p>}
    <ResourceState {...resource} retry={reload}>{resource.data && <><div className="owner-actions"><h2>{resource.data.data.name}</h2><Status value={resource.data.data.status} /><button onClick={reload}>Làm mới cơ sở</button></div>
      <FacilityEditors facility={resource.data.data} reload={reload} /><CourtManagement facility={resource.data.data} reload={reload} /><ReviewPanel path={`/facilities/${workspace.facilityId}/reviews`} />
    </>}</ResourceState></>;
}
