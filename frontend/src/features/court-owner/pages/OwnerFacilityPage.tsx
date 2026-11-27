import { FacilityHandoverPanel } from '@/components/common/facility-handover-panel';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DataTable } from '@/components/common/data-table';
import { Building2, MapPin, Plus, RefreshCw, SquareDashed } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
import { PageHeader } from '@/components/common/page-layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOwnerWorkspace } from '../hooks/owner-workspace';
import { useOwnerResource } from '../hooks/useOwnerResource';
import { Feedback, ResourceState, Status } from '../components/OwnerUi';
import { useOwnerAction } from '../hooks/useOwnerAction';
import { OwnerForm } from '../components/OwnerForm';
import { metadataFields, locationFields, courtFields } from '../components/owner-fields';
import { ReviewPanel } from '../components/ReviewPanel';
import { CreateFacilityAction, CreateFacilityPanel } from '../components/CreateFacilityPanel';
import { CourtDeletionAction } from '../components/CourtDeletionAction';
import { CourtProfileForm } from '../components/CourtProfileForm';
import { CourtProfileHistory } from '../components/CourtProfileHistory';
import { CourtStandardPanel } from '../components/CourtStandardPanel';
import { labels } from '../types/labels';
import { ownerApi } from '../services/owner-api';
import type { Facility } from '../types/owner';
function FacilityEditors({ facility, reload }: { facility: Facility; reload: () => void }) {
  const action = useOwnerAction();
  const rejected = facility.status === 'REJECTED';
  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"><ContentPanel title="Thông tin cơ sở" icon={Building2}><p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Đổi giờ sẽ bị từ chối nếu ảnh hưởng booking còn hiệu lực. Địa chỉ đã được duyệt chỉ thay đổi sau khi Admin duyệt đề xuất.</p>
    <OwnerForm key={facility.updatedAt} fields={rejected ? [...metadataFields, ...locationFields] : metadataFields} initial={{ ...facility }} title="Lưu thông tin cơ sở" busy={action.busy} disabled={facility.status === 'PENDING_APPROVAL'} submit={values => void action.run(() => ownerApi.write(`/facilities/${facility.id}`, values, 'PUT'), reload)} />
    {rejected && <Button type="button" variant="outline" className="h-11" onClick={() => void action.run(() => ownerApi.write(`/facilities/${facility.id}/resubmit`, {}), reload)} disabled={action.busy}>Gửi lại hồ sơ cơ sở</Button>}<Feedback {...action} /></ContentPanel>
    <aside className="min-w-0"><ContentPanel title="Địa chỉ đã lưu" icon={MapPin}><p>{[facility.address, facility.ward, facility.district, facility.city].filter(Boolean).join(', ')}</p>
      {facility.pendingAddressReview && <p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Địa chỉ chờ duyệt: {String(facility.pendingAddressReview.submittedValues.address)}</p>}
      {['ACTIVE', 'SUSPENDED'].includes(facility.status) && <><h3 className="border-t border-border pt-4 text-base font-bold">Gửi đề xuất địa chỉ</h3><OwnerForm fields={locationFields} initial={{ ...facility }} title="Gửi đề xuất địa chỉ" disabled={!!facility.pendingAddressReview} busy={action.busy} submit={values => void action.run(() => ownerApi.write(`/facilities/${facility.id}/address-change-requests`, values), reload)} /></>}
    </ContentPanel></aside></div>;
}
const COURT_TAB_CLASS = 'gap-4 pt-5 [&>section]:rounded-none [&>section]:border-0 [&>section]:p-0 [&>section]:shadow-none';
function CourtManagement({ facility, reload }: { facility: Facility; reload: () => void }) {
  const [search, setSearch] = useSearchParams();
  const courtParam = search.get('courtId');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const editing = facility.courts?.find(court => court.id === editingId) ?? null;
  const drawerOpen = adding || !!editing;
  const courtActionColumns = facility.courts?.some(court => court.status === 'REJECTED')
    ? 'grid-cols-[10.5rem_11.5rem_7.5rem]'
    : 'grid-cols-[10.5rem_11.5rem]';
  const action = useOwnerAction();
  const selectCourt = (id: number | null) => {
    setEditingId(id);
    const next = new URLSearchParams(search);
    if (id === null) next.delete('courtId');
    else next.set('courtId', String(id));
    if (!next.get('tab')) next.set('tab', 'courts');
    setSearch(next, { replace: true });
  };
  useEffect(() => {
    const id = Number(courtParam);
    if (!courtParam) { setEditingId(null); return; }
    setEditingId(Number.isSafeInteger(id) && id > 0 && facility.courts?.some(court => court.id === id) ? id : null);
  }, [courtParam, facility.courts]);
  const closeDrawer = () => { setAdding(false); selectCourt(null); };
  const save = (values: Record<string, unknown>) => void action.run(() => editing ? ownerApi.write(`/courts/${editing.id}`, values, 'PUT') : ownerApi.write(`/facilities/${facility.id}/courts`, values), () => { closeDrawer(); reload(); });
  return <ContentPanel><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-bold tracking-tight"><SquareDashed aria-hidden="true" className="size-5 shrink-0 text-primary" />Danh sách sân</h2><Button type="button" className="h-11" onClick={() => { setAdding(true); if (courtParam) selectCourt(null); }}><Plus aria-hidden="true" />Thêm sân</Button></div><DataTable scrollable data={facility.courts ?? []} keyExtractor={row => row.id} emptyState={<p>Chưa có sân. Thêm sân để gửi Admin duyệt.</p>} columns={[
    { key: 'name', header: 'Tên sân', minWidth: 130, render: row => row.name }, { key: 'description', header: 'Mô tả', minWidth: 190, render: row => row.description || 'Chưa có mô tả' },
    { key: 'surface', header: 'Mặt sân', minWidth: 180, render: row => <span>{row.surfaceType ? (labels[row.surfaceType] ?? row.surfaceType) : 'Chưa khai báo'}{row.surfaceThicknessMm ? ` · ${row.surfaceThicknessMm} mm` : ''}</span> },
    { key: 'condition', header: 'Tình trạng', minWidth: 130, render: row => <span>{row.condition ? (labels[row.condition] ?? row.condition) : 'Chưa khai báo'}</span> },
    { key: 'status', header: 'Trạng thái duyệt', minWidth: 160, render: row => <Status value={row.status} /> },
    { key: 'actions', header: 'Thao tác', width: '1%', minWidth: 160, className: 'whitespace-nowrap', render: row => <div className={`grid items-center gap-3 ${courtActionColumns}`}><Button type="button" variant="outline" className="h-11" onClick={() => { setAdding(false); selectCourt(row.id); }}>Chi tiết / Sửa sân</Button><CourtDeletionAction court={row} changed={reload} />{row.status === 'REJECTED' && <Button type="button" variant="outline" className="h-11" disabled={action.busy} onClick={() => void action.run(() => ownerApi.write(`/courts/${row.id}/resubmit`, {}), reload)}>Gửi lại sân</Button>}</div> },
  ]} />
    {!drawerOpen && <Feedback {...action} />}
    <Dialog open={drawerOpen} onOpenChange={open => { if (!open) closeDrawer(); }}>
      <DialogContent variant="side" aria-describedby={undefined} className="flex flex-col gap-5" onInteractOutside={event => event.preventDefault()}>
        <DialogTitle>{editing ? `Sửa sân: ${editing.name}` : 'Thêm sân mới'}</DialogTitle>
        {editing && <div className="flex flex-wrap items-center gap-2"><Status value={editing.status} /><span className="text-sm text-muted-foreground">{facility.name}</span></div>}
        {!editing && <><OwnerForm key={`new-${facility.courts?.length}`} fields={courtFields} initial={{}} title="Gửi sân để duyệt" busy={action.busy} submit={save} /><Feedback {...action} /></>}
        {editing && <Tabs defaultValue="info" className="min-w-0">
          <TabsList aria-label="Chi tiết sân"><TabsTrigger value="info">Thông tin</TabsTrigger><TabsTrigger value="profile">Thông số</TabsTrigger><TabsTrigger value="standards">Tiêu chuẩn</TabsTrigger><TabsTrigger value="history">Lịch sử</TabsTrigger><TabsTrigger value="reviews">Duyệt</TabsTrigger></TabsList>
          <TabsContent value="info" forceMount className={COURT_TAB_CLASS}><OwnerForm key={editing.id} fields={courtFields} initial={{ ...editing }} title="Lưu thông tin sân" busy={action.busy} disabled={editing.status === 'PENDING_APPROVAL'} submit={save} /><Feedback {...action} /></TabsContent>
          {editing.status === 'PENDING_APPROVAL'
            ? <TabsContent value="profile" forceMount className={COURT_TAB_CLASS}><p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Sân đang chờ duyệt nên chưa thể sửa thông số. Vui lòng chờ Admin xử lý hồ sơ.</p></TabsContent>
            : <TabsContent value="profile" forceMount className={COURT_TAB_CLASS}><CourtProfileForm key={`profile-${editing.id}-${editing.profileVersion}`} court={editing} saved={reload} /></TabsContent>}
          {editing.status !== 'PENDING_APPROVAL' && <>
            <TabsContent value="standards" forceMount className={COURT_TAB_CLASS}><CourtStandardPanel key={`standards-${editing.id}`} court={editing} /></TabsContent>
            <TabsContent value="history" forceMount className={COURT_TAB_CLASS}><CourtProfileHistory key={`history-${editing.id}`} courtId={editing.id} /></TabsContent>
          </>}
          <TabsContent value="reviews" forceMount className={COURT_TAB_CLASS}><ReviewPanel target="court" key={editing.id} path={`/courts/${editing.id}/reviews`} /></TabsContent>
        </Tabs>}
      </DialogContent>
    </Dialog>
  </ContentPanel>;
}
const FACILITY_TABS = ['info', 'courts', 'reviews', 'handover'];
export function OwnerFacilityPage() {
  const workspace = useOwnerWorkspace();
  const [search, setSearch] = useSearchParams();
  const resource = useOwnerResource<{ data: Facility }>(workspace.facilityId ? `/facilities/${workspace.facilityId}` : null, true);
  const reload = () => { resource.reload(); workspace.refresh(); };
  const requested = search.get('tab') ?? '';
  const tab = FACILITY_TABS.includes(requested) ? requested : search.get('courtId') ? 'courts' : 'info';
  const changeTab = (value: string) => { const next = new URLSearchParams(search); next.set('tab', value); setSearch(next, { replace: true }); };
  const facility = resource.data?.data;
  if (!workspace.facilityId) return <div className="flex min-w-0 flex-col gap-6"><PageHeader title="Quản lý cơ sở" /><CreateFacilityPanel /><FacilityHandoverPanel changed={reload} /><p>Bạn chưa có cơ sở.</p></div>;
  return <div className="flex min-w-0 flex-col gap-6"><PageHeader title="Quản lý cơ sở" description={facility && <span className="flex flex-wrap items-center gap-2"><strong className="text-foreground">{facility.name}</strong><Status value={facility.status} /></span>} actions={<><Button type="button" variant="outline" className="h-11" onClick={reload}><RefreshCw aria-hidden="true" />Làm mới cơ sở</Button><CreateFacilityAction /></>} />
    <ResourceState {...resource} retry={reload}>{facility && <Tabs value={tab} onValueChange={changeTab} className="min-w-0">
      <TabsList aria-label="Nội dung quản lý cơ sở"><TabsTrigger value="info">Thông tin</TabsTrigger><TabsTrigger value="courts">Sân<span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{facility.courts?.length ?? 0}</span></TabsTrigger><TabsTrigger value="reviews">Lịch sử duyệt</TabsTrigger><TabsTrigger value="handover">Tiếp nhận cơ sở</TabsTrigger></TabsList>
      <TabsContent value="info" forceMount className="pt-6"><FacilityEditors facility={facility} reload={reload} /></TabsContent>
      <TabsContent value="courts" forceMount className="pt-6"><CourtManagement facility={facility} reload={reload} /></TabsContent>
      <TabsContent value="reviews" forceMount className="pt-6"><ReviewPanel target="facility" path={`/facilities/${workspace.facilityId}/reviews`} /></TabsContent>
      <TabsContent value="handover" forceMount className="pt-6"><FacilityHandoverPanel changed={reload} /></TabsContent>
    </Tabs>}</ResourceState></div>;
}
