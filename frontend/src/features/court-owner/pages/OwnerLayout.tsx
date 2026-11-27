import { useEffect, useState } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import { SkipLink } from '@/components/common/skip-link';
import { OwnerFooter } from '../components/OwnerFooter';
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
    <OwnerHeader query={query} email={user?.email} signOut={signOut} facilities={facilities} facilityId={facilityId} onSelectFacility={select} />
    <main id="owner-main" tabIndex={-1} className="mx-auto grid w-full max-w-360 flex-1 grid-cols-1 content-start gap-6 px-4 py-6 outline-none sm:px-6 sm:py-8"><ResourceState loading={loading} error={error} retry={refresh}>
      {!loading && (!error || facilities.length > 0) && <OwnerWorkspace.Provider value={{ facilities, facilityId, select, refresh }}>
        <div className="min-w-0" key={facilityId ?? 'no-facility'}><Outlet /></div>
      </OwnerWorkspace.Provider>}
    </ResourceState></main>
    <OwnerFooter query={query} />
    <OwnerNavigation query={query} mobile />
  </div>;
}
