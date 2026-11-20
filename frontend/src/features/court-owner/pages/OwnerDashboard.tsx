import { Link, useSearchParams } from 'react-router-dom';
import { Building2, CalendarDays, CircleDollarSign, MapPin, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/common/page-layout';
import { ContentPanel } from '@/components/common/content-panel';
import { Button } from '@/components/ui/button';
import { useOwnerWorkspace } from '../hooks/owner-workspace';
import { Status } from '../components/OwnerUi';
import { CreateFacilityPanel } from '../components/CreateFacilityPanel';
export function OwnerDashboard() {
  const { facilities, facilityId } = useOwnerWorkspace();
  const [search] = useSearchParams();
  const query = facilityId ? `?facilityId=${facilityId}` : `?${search}`;
  return <div className="flex min-w-0 flex-col gap-6"><PageHeader title="Bảng điều khiển Chủ sân" description="Quản lý cơ sở, giá sân và lịch đặt trong phạm vi của bạn." />
    {!facilities.length && <p className="rounded-lg bg-success-bg p-4 text-sm leading-6 text-success">Bạn chưa có cơ sở. Hãy gửi thông tin cơ sở đầu tiên để Admin duyệt.</p>}
    <CreateFacilityPanel />
    <div className="grid gap-5 lg:grid-cols-2">{facilities.map(facility => <ContentPanel key={facility.id}><div className="flex items-start gap-3"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-success-bg text-primary"><Building2 aria-hidden="true" className="size-6" /></span><h2 className="min-w-0 break-words text-lg font-bold tracking-tight">{facility.name}</h2></div><Status value={facility.status} /><p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"><MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" />{[facility.address, facility.ward, facility.district, facility.city].filter(Boolean).join(', ')}</p><Button asChild variant="outline" className="mt-auto h-11 self-start"><Link to={`/owner/facilities?facilityId=${facility.id}`}>Quản lý cơ sở này<ArrowRight aria-hidden="true" /></Link></Button></ContentPanel>)}</div>
    {facilityId && <nav aria-label="Thao tác Chủ sân" className="flex flex-wrap gap-3"><Button asChild variant="outline" className="h-11"><Link to={`/owner/pricing${query}`}><CircleDollarSign aria-hidden="true" />Bảng giá sân</Link></Button><Button asChild className="h-11"><Link to={`/owner/schedule${query}`}><CalendarDays aria-hidden="true" />Lịch đặt & Giám sát</Link></Button></nav>}
  </div>;
}
