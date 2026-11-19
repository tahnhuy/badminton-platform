import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/use-auth';
import { ownerApi } from '../services/owner-api';
import { OwnerWorkspace } from '../hooks/owner-workspace';
import { ResourceState } from '../components/OwnerUi';

import { FilterToolbar } from '../../../components/common/FilterToolbar';
import type { Facility } from '../types/owner';
import logo from '../assets/owner-logo.svg';
import '../owner.css';
export function OwnerLayout() {
  const { user, signOut } = useAuth();
  const [search, setSearch] = useSearchParams();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    ownerApi.facilities(controller.signal).then(rows => { if (active) { setFacilities(rows); setError(''); } }).catch(() => { if (active) setError('Không thể tải danh sách cơ sở.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [revision]);
  const requested = Number(search.get('facilityId'));
  const facilityId = facilities.some(row => row.id === requested) ? requested : facilities[0]?.id ?? null;
  const select = (id: number) => setSearch({ facilityId: String(id) });
  const query = facilityId ? `?facilityId=${facilityId}` : '';
  const refresh = () => setRevision(value => value + 1);
  return <div className="owner-app"><header className="owner-header"><Link className="owner-brand" to="/owner"><img src={logo} alt="" /><strong>SmashPro</strong><span>OWNER</span></Link>
    <nav aria-label="Kênh Chủ sân">{[['', 'Bảng điều khiển'], ['/facilities', 'Quản lý cơ sở'], ['/pricing', 'Bảng giá sân'], ['/schedule', 'Lịch đặt & Giám sát'], ['/wallet', 'Ví & thu nhập'], ['/account', 'Tài khoản']].map(([path, label]) => <NavLink key={path} end to={`/owner${path}${query}`}>{label}</NavLink>)}</nav>
    <div className="owner-account"><span>{user?.email}</span><button onClick={() => void signOut()}>Đăng xuất</button></div></header>
    <main className="owner-main"><ResourceState loading={loading} error={error} retry={refresh}>
      {!loading && (!error || facilities.length > 0) && <OwnerWorkspace.Provider value={{ facilities, facilityId, select, refresh }}>
        {facilities.length > 0 && <FilterToolbar filters={[{ id: 'owner-facility', value: String(facilityId), ariaLabel: 'Chọn cơ sở', options: facilities.map(row => ({ value: String(row.id), label: row.name })), onChange: value => select(Number(value)) }]} />}
        <div key={facilityId ?? 'no-facility'}><Outlet /></div>
      </OwnerWorkspace.Provider>}
    </ResourceState></main><footer className="owner-footer">SmashPro · Kênh quản lý cơ sở cầu lông</footer></div>;
}
