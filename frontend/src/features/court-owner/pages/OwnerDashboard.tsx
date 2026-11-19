import { Link, useSearchParams } from 'react-router-dom';
import { useOwnerWorkspace } from '../hooks/owner-workspace';
import { Status } from '../components/OwnerUi';
import { CreateFacilityPanel } from '../components/CreateFacilityPanel';
import '../owner.css';
export function OwnerDashboard() {
  const { facilities, facilityId } = useOwnerWorkspace();
  const [search] = useSearchParams();
  const query = facilityId ? `?facilityId=${facilityId}` : `?${search}`;
  return <div className="owner-main contents"><h1>Bảng điều khiển Chủ sân</h1><p>Quản lý cơ sở, giá sân và lịch đặt trong phạm vi của bạn.</p>
    {!facilities.length && <p className="owner-note">Bạn chưa có cơ sở. Hãy gửi thông tin cơ sở đầu tiên để Admin duyệt.</p>}
    <CreateFacilityPanel />
    <div className="owner-list">{facilities.map(facility => <article className="owner-card" key={facility.id}><h2>{facility.name}</h2><Status value={facility.status} /><p>{[facility.address, facility.ward, facility.district, facility.city].filter(Boolean).join(', ')}</p><Link to={`/owner/facilities?facilityId=${facility.id}`}>Quản lý cơ sở này</Link></article>)}</div>
    {facilityId && <nav className="owner-actions"><Link to={`/owner/pricing${query}`}>Bảng giá sân</Link><Link to={`/owner/schedule${query}`}>Lịch đặt & Giám sát</Link></nav>}
  </div>;
}
