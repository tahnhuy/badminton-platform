import { useEffect, useState } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { SkipLink } from '@/components/common/skip-link';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { OwnerHeader } from '../components/OwnerHeader';
import { OwnerNavigation } from '../components/OwnerNavigation';
import { useAuth } from '../../auth/use-auth';
import { ownerApi } from '../services/owner-api';
import { OwnerWorkspace } from '../hooks/owner-workspace';
import { ResourceState } from '../components/OwnerUi';

import type { Facility } from '../types/owner';

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
  return <div className="flex min-h-svh flex-col bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] font-sans text-foreground lg:pb-0">
    <SkipLink targetId="owner-main" />
    <OwnerHeader query={query} email={user?.email} signOut={signOut} />
    <main id="owner-main" tabIndex={-1} className="owner-main w-full flex-1 content-start outline-none"><ResourceState loading={loading} error={error} retry={refresh}>
      {!loading && (!error || facilities.length > 0) && <OwnerWorkspace.Provider value={{ facilities, facilityId, select, refresh }}>
        {facilities.length > 0 && <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"><Label htmlFor="owner-facility" className="flex items-center gap-2 text-sm font-bold"><Building2 aria-hidden="true" className="size-5 text-primary" />Chọn cơ sở</Label><NativeSelect id="owner-facility" aria-label="Chọn cơ sở" className="sm:max-w-96" value={String(facilityId)} onChange={event => select(Number(event.target.value))}>{facilities.map(row => <option key={row.id} value={String(row.id)}>{row.name}</option>)}</NativeSelect></div>}
        <div key={facilityId ?? 'no-facility'}><Outlet /></div>
      </OwnerWorkspace.Provider>}
    </ResourceState></main>
    <footer className="mt-auto border-t border-border px-4 py-6 text-xs text-muted-foreground sm:px-6">SmashPro · Kênh quản lý cơ sở cầu lông</footer>
    <OwnerNavigation query={query} mobile />
  </div>;
}
