import { ApiError } from '@/shared/api/http-client';
import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
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
import { AdminHeader } from '../components/AdminHeader';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminMain } from '../components/AdminMain';
import type { Court, Facility } from '../types/facility';

function ReviewAttempt({ review, facilityId, courtId, changed, facility }: { review: FacilityReview; facilityId: number; courtId?: number; changed: () => void; facility: Facility }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function decide(approve: boolean) {
    if (busy || (!approve && !reason.trim())) return;
    setBusy(true); setError('');
    try { await facilityReviewService.decide(facilityId, review, approve, reason, courtId); changed(); }
    catch (error) { setError(error instanceof ApiError && error.code === 'COURT_DELETION_ACTIVE_BOOKINGS' ? 'Sân còn booking sắp diễn ra hoặc đang chơi. Vui lòng xử lý lịch trước khi duyệt xóa.' : 'Không thể quyết định hồ sơ. Hồ sơ có thể đã thay đổi; hãy tải lại.'); }
    finally { setBusy(false); }
  }
  return <article className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-base font-bold">{review.kind === 'COURT_DELETION' ? 'Yêu cầu xóa sân' : review.kind === 'ADDRESS_CHANGE' ? 'Đề xuất thay đổi địa chỉ' : 'Hồ sơ đăng ký'}</h3>
      <Badge variant={review.status === 'APPROVED' ? 'success' : 'neutral'}>{review.status === 'PENDING' ? 'Chờ duyệt' : review.status === 'APPROVED' ? 'Đã duyệt' : 'Bị từ chối'}</Badge>
    </div>
    <p className="text-xs text-muted-foreground">Gửi lúc: {formatDate(review.submittedAt)}{review.reviewedAt ? ` · Xử lý lúc: ${formatDate(review.reviewedAt)}` : ''}</p>
    {review.kind === 'ADDRESS_CHANGE' && <div className="grid gap-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
      <div><p className="text-xs font-semibold text-muted-foreground">Địa chỉ hiện tại</p><p className="mt-1 text-sm">{[facility.address, facility.ward, facility.district, facility.city].filter(Boolean).join(', ')}</p></div>
      <div><p className="text-xs font-semibold text-muted-foreground">Địa chỉ đề xuất</p><p className="mt-1 text-sm">{['address', 'ward', 'district', 'city'].map(key => review.submittedValues[key]).filter(Boolean).join(', ')}</p></div>
    </div>}
    <div>{Object.entries(review.submittedValues).filter(([key]) => ['name', 'description', 'phone', 'address', 'ward', 'district', 'city', 'openingTime', 'closingTime'].includes(key)).map(([key, value]) => <DetailRow key={key} label={({ name: 'Tên', description: 'Mô tả', phone: 'Điện thoại', address: 'Địa chỉ đề xuất', ward: 'Phường/xã', district: 'Quận/huyện', city: 'Tỉnh/thành', openingTime: 'Mở cửa', closingTime: 'Đóng cửa' } as Record<string, string>)[key]} value={value == null ? 'Không cung cấp' : String(value)} />)}</div>
    {review.kind === 'COURT_DELETION' && <div className="space-y-3"><DetailRow label="Lý do yêu cầu xóa" value={String(review.submittedValues.reason ?? '')} /><Alert variant="warning">Duyệt yêu cầu sẽ ẩn sân khỏi danh sách đặt mới và giữ lại lịch sử. Không thể duyệt khi còn booking sắp diễn ra hoặc đang chơi.</Alert></div>}
    {review.rejectionReason && <Alert variant="warning">Lý do từ chối: {review.rejectionReason}</Alert>}
    {review.status === 'PENDING' && <form className="space-y-3 border-t border-border pt-4" onSubmit={(event: FormEvent) => { event.preventDefault(); void decide(false); }}>
      <label className="block space-y-2 text-sm font-semibold">Lý do từ chối (bắt buộc khi từ chối)<Textarea required value={reason} onChange={event => setReason(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={review.kind === 'COURT_DELETION' ? 'danger-soft' : 'default'} disabled={busy} onClick={() => void decide(true)}>{review.kind === 'COURT_DELETION' ? 'Duyệt xóa sân' : 'Duyệt hồ sơ'}</Button>
        <Button variant="danger-soft" type="submit" disabled={busy || !reason.trim()}>Từ chối hồ sơ</Button>
      </div>
    </form>}
    {error && <Alert variant="destructive">{error}</Alert>}
  </article>;
}
function ReviewHistory({ facilityId, courtId, changed, facility }: { facilityId: number; courtId?: number; changed: () => void; facility: Facility }) {
  const [page, setPage] = useState(1);
  const path = `/api/v1/admin/facilities/${facilityId}${courtId ? `/courts/${courtId}` : ''}/reviews?page=${page}&limit=10`;
  const resource = useApiResource<{ data: FacilityReview[]; meta: { totalPages: number } }>(path, true);
  return <ContentPanel title={courtId ? 'Lịch sử xét duyệt sân' : 'Hồ sơ cơ sở và địa chỉ'} icon={ClipboardCheck}>
    {resource.loading && <div role="status" className="space-y-2">
      <p className="text-sm text-muted-foreground">Đang tải hồ sơ…</p>
      <Skeleton className="h-24 w-full" />
    </div>}
    {resource.error && <Alert variant="destructive">{resource.error}<Button variant="outline" className="ml-2" onClick={resource.reload}>Thử lại</Button>
    </Alert>}
    {resource.data?.data.length === 0 && <p className="py-4 text-sm text-muted-foreground">Chưa có hồ sơ duyệt.</p>}
    {resource.data?.data.map(review => <ReviewAttempt key={review.id} review={review} facility={facility} facilityId={facilityId} courtId={courtId} changed={() => { resource.reload(); changed(); }} />)}
    <nav aria-label={courtId ? 'Phân trang hồ sơ sân' : 'Phân trang hồ sơ cơ sở'} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm">
      <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</Button>
      <span>Trang {page}</span>
      <Button variant="outline" disabled={!resource.data || page >= resource.data.meta.totalPages} onClick={() => setPage(page + 1)}>Trang sau</Button>
    </nav>
  </ContentPanel>;
}
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang hoạt động', SUSPENDED: 'Tạm đình chỉ', INACTIVE: 'Ngừng hoạt động',
  PENDING_APPROVAL: 'Chờ duyệt', REJECTED: 'Bị từ chối', MAINTENANCE: 'Bảo trì',
  PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', VERIFIED: 'Đã xác minh', INVALIDATED: 'Mất hiệu lực',
};
function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}
function CourtStandards({ court }: { court: Court }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return court.standardClaims?.length ? <div className="space-y-2">{court.standardClaims.map(claim => {
    const expired = claim.status === 'VERIFIED' && claim.expiresAt && claim.expiresAt < today;
    return <div key={claim.id} className="space-y-1"><p className="text-sm font-semibold">{claim.standardName}</p>
      <Badge variant={claim.status === 'VERIFIED' && !expired ? 'success' : 'neutral'}>{expired ? 'Hết hiệu lực' : STATUS_LABELS[claim.status] ?? claim.status}</Badge>
    </div>;
  })}</div> : <span className="text-sm text-muted-foreground">Chưa khai báo</span>;
}
export function FacilityReviewPage() {
  const { facilityId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedCourt = searchParams.get('courtId');
  const courtId = requestedCourt && /^\d+$/.test(requestedCourt) && Number(requestedCourt) > 0 ? Number(requestedCourt) : undefined;
  const from = searchParams.get('from') === 'approvals' ? 'approvals' : 'courts';
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const resource = useApiResource<{ data: Facility }>(`/api/v1/admin/facilities/${facilityId}`);
  const facility = resource.data?.data;
  const court = facility?.courts?.find(item => item.id === courtId);
  const profilePath = `/admin/courts/${facilityId}/reviews`;
  const sortedCourts = [...(facility?.courts ?? [])].sort((a, b) => {
    const priority = Number(b.latestReview?.status === 'PENDING') - Number(a.latestReview?.status === 'PENDING');
    return priority || (b.latestReview?.submittedAt ?? '').localeCompare(a.latestReview?.submittedAt ?? '') || a.id - b.id;
  });
  return <div className="flex min-h-svh bg-background text-foreground">
    <AdminSidebar isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(value => !value)} isMobileOpen={isMobileOpen} onMobileClose={() => setIsMobileOpen(false)} />
    <AdminMain isCollapsed={isCollapsed}>
      <AdminHeader isCollapsed={isCollapsed} onToggleMobileSidebar={() => setIsMobileOpen(true)} />
      <main id="admin-main-content" tabIndex={-1} className="min-w-0">
      <PageContainer className="min-w-0 pt-24">
        <Link className={buttonVariants({ variant: 'ghost', className: 'self-start' })} to={from === 'approvals' ? '/admin/approvals' : '/admin/courts'}>
          <ArrowLeft aria-hidden="true" />{from === 'approvals' ? 'Danh sách chờ duyệt' : 'Quản lý cơ sở'}</Link>
        <PageHeader title={court ? `Hồ sơ sân · ${court.name}` : 'Duyệt hồ sơ cơ sở'} />
        {resource.loading && <div role="status"><p>Đang tải…</p><Skeleton className="mt-2 h-24 w-full" /></div>}
        {resource.error && <Alert variant="destructive">{resource.error}<Button variant="outline" className="ml-2" onClick={resource.reload}>Thử lại</Button></Alert>}
        {facility && <>
          <ContentPanel title={facility.name} icon={Building2}>
            <p className="text-sm text-muted-foreground">Địa chỉ đang lưu: {[facility.address, facility.ward, facility.district, facility.city].filter(Boolean).join(', ')}</p>
            <p className="text-sm">Trạng thái hiện tại: <Badge>{STATUS_LABELS[facility.status] ?? facility.status}</Badge></p>
            {requestedCourt ? <>
              <Link to={`${profilePath}?from=${from}`} className={buttonVariants({ variant: 'outline', className: 'self-start' })}>Danh sách sân của cơ sở</Link>
              {!court ? <Alert variant="destructive">Không tìm thấy sân trong cơ sở này.</Alert> : <>
                <DetailRow label="Sân" value={court.name} />
                <DetailRow label="Trạng thái hoạt động" value={STATUS_LABELS[court.status] ?? court.status} />
                <DetailRow label="Mô tả" value={court.description || 'Chưa khai báo'} />
                <DetailRow label="Mặt sân" value={({ PVC: 'PVC', WOOD: 'Gỗ', PU_ACRYLIC: 'PU / Acrylic', OTHER: 'Khác' } as Record<string, string>)[court.surfaceType ?? ''] ?? 'Chưa khai báo'} />
                <DetailRow label="Thương hiệu / Dòng sản phẩm" value={[court.surfaceBrand, court.surfaceModel].filter(Boolean).join(' · ') || 'Chưa khai báo'} />
                <DetailRow label="Độ dày" value={court.surfaceThicknessMm ? `${court.surfaceThicknessMm} mm` : 'Chưa khai báo'} />
                <DetailRow label="Tiêu chuẩn sân" value={<CourtStandards court={court} />} />
                <Link to="/admin/standards" className={buttonVariants({ variant: 'outline', className: 'self-start' })}>Đến danh sách duyệt tiêu chuẩn</Link>
              </>}
            </> : <DataTable scrollable data={sortedCourts} keyExtractor={item => item.id} columns={[
              { key: 'name', header: 'SÂN', minWidth: 200, render: item => <div><p className="font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">Mã sân #{item.id}</p></div> },
              { key: 'status', header: 'TRẠNG THÁI HOẠT ĐỘNG', minWidth: 200, render: item => <Badge>{item.deletedAt ? 'Đã vô hiệu hóa' : STATUS_LABELS[item.status] ?? item.status}</Badge> },
              { key: 'review', header: 'HỒ SƠ XÉT DUYỆT', minWidth: 180, render: item => item.latestReview ? <Badge variant={item.latestReview.status === 'APPROVED' ? 'success' : 'neutral'}>{STATUS_LABELS[item.latestReview.status] ?? item.latestReview.status}</Badge> : <span className="text-sm text-muted-foreground">Chưa có hồ sơ</span> },
              { key: 'standard', header: 'TIÊU CHUẨN SÂN', minWidth: 260, render: item => <CourtStandards court={item} /> },
              { key: 'submitted', header: 'GỬI GẦN NHẤT', minWidth: 180, render: item => formatDate(item.latestReview?.submittedAt) },
              { key: 'actions', header: 'THAO TÁC', minWidth: 150, render: item => <Link className={buttonVariants({ variant: 'outline' })} to={`${profilePath}?courtId=${item.id}&from=${from}`}>Xem hồ sơ</Link> },
            ]} emptyState={<p className="text-sm text-muted-foreground">Cơ sở chưa có sân.</p>} />}
          </ContentPanel>
          {requestedCourt ? court && <ReviewHistory key={`${facilityId}:${courtId}`} facilityId={Number(facilityId)} courtId={courtId} facility={facility} changed={resource.reload} /> : <ReviewHistory key={facilityId} facilityId={Number(facilityId)} facility={facility} changed={resource.reload} />}
        </>}
      </PageContainer>
      </main>
    </AdminMain>
  </div>;
}
