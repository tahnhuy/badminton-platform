import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useOwnerWorkspace } from '../hooks/owner-workspace';
import { OwnerForm } from '../components/OwnerForm';
import { metadataFields, locationFields } from '../components/owner-fields';
import { Feedback, Status } from '../components/OwnerUi';
import { useOwnerAction } from '../hooks/useOwnerAction';
import { ownerApi } from '../services/owner-api';
import type { Facility } from '../types/owner';
export function CreateFacilityPanel() {
  const workspace = useOwnerWorkspace();
  const action = useOwnerAction();
  const [open, setOpen] = useState(workspace.facilities.length === 0);
  return <section className="owner-card"><button className="owner-primary" onClick={() => setOpen(!open)}>{open ? 'Đóng biểu mẫu' : 'Thêm cơ sở'}</button>
    {open && <><h2>Gửi cơ sở mới để duyệt</h2><p>Cơ sở và sân chỉ nhận đặt sau khi Admin duyệt và đã có giá hợp lệ.</p>
      <OwnerForm fields={[...metadataFields, ...locationFields]} title="Gửi cơ sở để duyệt" busy={action.busy} submit={values => void action.run(async () => { const result = await ownerApi.write<Facility>('/facilities', values); workspace.select(result.data.id); workspace.refresh(); setOpen(false); })} />
    </>}<Feedback {...action} /></section>;
}
export function OwnerDashboard() {
  const { facilities, facilityId } = useOwnerWorkspace();
  const [search] = useSearchParams();
  const query = facilityId ? `?facilityId=${facilityId}` : `?${search}`;
  return <><h1>Bảng điều khiển Chủ sân</h1><p>Quản lý cơ sở, giá sân và lịch đặt trong phạm vi của bạn.</p>
    {!facilities.length && <p className="owner-note">Bạn chưa có cơ sở. Hãy gửi thông tin cơ sở đầu tiên để Admin duyệt.</p>}
    <CreateFacilityPanel />
    <div className="owner-list">{facilities.map(facility => <article className="owner-card" key={facility.id}><h2>{facility.name}</h2><Status value={facility.status} /><p>{[facility.address, facility.ward, facility.district, facility.city].filter(Boolean).join(', ')}</p><Link to={`/owner/facilities?facilityId=${facility.id}`}>Quản lý cơ sở này</Link></article>)}</div>
    {facilityId && <nav className="owner-actions"><Link to={`/owner/pricing${query}`}>Bảng giá sân</Link><Link to={`/owner/schedule${query}`}>Lịch đặt & Giám sát</Link></nav>}
  </>;
}
