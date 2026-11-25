import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, Building2 } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { ContentPanel, DetailRow } from '@/components/common/content-panel';
import { DataTable } from '@/components/common/data-table';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import { facilityReviewService, type FacilityReview } from '../services/facility-review-service';
import type { Facility } from '../types/facility';

function ReviewAttempt({ review, facilityId, courtId, changed }: { review: FacilityReview; facilityId: number; courtId?: number; changed: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function decide(approve: boolean) {
    if (busy || (!approve && !reason.trim())) return;
    setBusy(true); setError('');
    try { await facilityReviewService.decide(facilityId, review, approve, reason, courtId); changed(); }
    catch { setError('Không thể quyết định hồ sơ. Hồ sơ có thể đã thay đổi; hãy tải lại.'); }
    finally { setBusy(false); }
  }
  return <article className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-base font-bold">{review.kind === 'ADDRESS_CHANGE' ? 'Đề xuất thay đổi địa chỉ' : 'Hồ sơ đăng ký'}</h3>
      <Badge variant={review.status === 'APPROVED' ? 'success' : 'neutral'}>{review.status === 'PENDING' ? 'Chờ duyệt' : review.status === 'APPROVED' ? 'Đã duyệt' : 'Bị từ chối'}</Badge>
    </div>
    <div>{Object.entries(review.submittedValues).filter(([key]) => ['name', 'description', 'phone', 'address', 'ward', 'district', 'city', 'openingTime', 'closingTime'].includes(key)).map(([key, value]) => <DetailRow key={key} label={({ name: 'Tên', description: 'Mô tả', phone: 'Điện thoại', address: 'Địa chỉ đề xuất', ward: 'Phường/xã', district: 'Quận/huyện', city: 'Tỉnh/thành', openingTime: 'Mở cửa', closingTime: 'Đóng cửa' } as Record<string, string>)[key]} value={value == null ? 'Không cung cấp' : String(value)} />)}</div>
    {review.rejectionReason && <Alert variant="warning">Lý do từ chối: {review.rejectionReason}</Alert>}
    {review.status === 'PENDING' && <form className="space-y-3 border-t border-border pt-4" onSubmit={(event: FormEvent) => { event.preventDefault(); void decide(false); }}>
      <label className="block space-y-2 text-sm font-semibold">Lý do từ chối (bắt buộc khi từ chối)<Textarea required value={reason} onChange={event => setReason(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void decide(true)}>Duyệt hồ sơ</Button>
        <Button variant="danger-soft" type="submit" disabled={busy || !reason.trim()}>Từ chối hồ sơ</Button>
      </div>
    </form>}
    {error && <Alert variant="destructive">{error}</Alert>}
  </article>;
}
function ReviewHistory({ facilityId, courtId, changed }: { facilityId: number; courtId?: number; changed: () => void }) {
  const [page, setPage] = useState(1);
  const path = `/api/v1/admin/facilities/${facilityId}${courtId ? `/courts/${courtId}` : ''}/reviews?page=${page}&limit=10`;
  const resource = useApiResource<{ data: FacilityReview[]; meta: { totalPages: number } }>(path, true);
  return <ContentPanel title={courtId ? 'Hồ sơ sân' : 'Hồ sơ cơ sở và địa chỉ'} icon={ClipboardCheck}>
    {resource.loading && <div role="status" className="space-y-2">
      <p className="text-sm text-muted-foreground">Đang tải hồ sơ…</p>
      <Skeleton className="h-24 w-full" />
    </div>}
    {resource.error && <Alert variant="destructive">{resource.error}<Button variant="outline" className="ml-2" onClick={resource.reload}>Thử lại</Button>
    </Alert>}
    {resource.data?.data.length === 0 && <p className="py-4 text-sm text-muted-foreground">Chưa có hồ sơ duyệt.</p>}
    {resource.data?.data.map(review => <ReviewAttempt key={review.id} review={review} facilityId={facilityId} courtId={courtId} changed={() => { resource.reload(); changed(); }} />)}
    <nav aria-label={courtId ? 'Phân trang hồ sơ sân' : 'Phân trang hồ sơ cơ sở'} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm">
      <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</Button>
      <span>Trang {page}</span>
      <Button variant="outline" disabled={!resource.data || page >= resource.data.meta.totalPages} onClick={() => setPage(page + 1)}>Trang sau</Button>
    </nav>
  </ContentPanel>;
}
export function FacilityReviewPage() {
  const { facilityId } = useParams();
  const [selected, setSelected] = useState<number | undefined>();
  const resource = useApiResource<{ data: Facility }>(`/api/v1/admin/facilities/${facilityId}`);
  const facility = resource.data?.data;
  return <main className="min-h-svh bg-background text-foreground">
    <PageContainer>
      <Link className={buttonVariants({ variant: 'ghost', className: 'self-start' })} to="/admin/courts">
        <ArrowLeft aria-hidden="true" />Quản lý cơ sở</Link>
      <PageHeader title="Duyệt hồ sơ cơ sở" />
      {resource.loading && <div role="status">
        <p>Đang tải…</p>
        <Skeleton className="mt-2 h-24 w-full" />
      </div>}
      {resource.error && <Alert variant="destructive">{resource.error}<Button variant="outline" className="ml-2" onClick={resource.reload}>Thử lại</Button>
      </Alert>}
      {facility && <>
        <ContentPanel title={facility.name} icon={Building2}>
          <p className="text-sm text-muted-foreground">Địa chỉ đang lưu: {[facility.address, facility.ward, facility.district, facility.city].filter(Boolean).join(', ')}</p>
          <p className="text-sm">Trạng thái hiện tại: <Badge>{facility.status}</Badge>
          </p>
          <DataTable data={facility.courts ?? []} keyExtractor={court => court.id} columns={[{ key: 'name', header: 'Sân', render: court => court.name }, { key: 'status', header: 'Trạng thái', render: court => court.status }, { key: 'review', header: 'Duyệt', render: court => <Button variant="outline" onClick={() => setSelected(court.id)}>Xem hồ sơ sân {court.name}</Button> }]} />
        </ContentPanel>
        <ReviewHistory facilityId={Number(facilityId)} changed={resource.reload} />{selected && <ReviewHistory key={selected} facilityId={Number(facilityId)} courtId={selected} changed={resource.reload} />}</>}
    </PageContainer>
  </main>;
}
