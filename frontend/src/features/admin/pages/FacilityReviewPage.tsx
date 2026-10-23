import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DataTable } from '../../../components/common/DataTable';
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
  return <article className="owner-card"><h3>{review.kind === 'ADDRESS_CHANGE' ? 'Đề xuất thay đổi địa chỉ' : 'Hồ sơ đăng ký'}</h3><p>Trạng thái: {review.status === 'PENDING' ? 'Chờ duyệt' : review.status === 'APPROVED' ? 'Đã duyệt' : 'Bị từ chối'}</p>
    <dl>{Object.entries(review.submittedValues).filter(([key]) => ['name', 'description', 'phone', 'address', 'ward', 'district', 'city', 'latitude', 'longitude', 'openingTime', 'closingTime'].includes(key)).map(([key, value]) => <div key={key}><dt>{({ name: 'Tên', description: 'Mô tả', phone: 'Điện thoại', address: 'Địa chỉ đề xuất', ward: 'Phường/xã', district: 'Quận/huyện', city: 'Tỉnh/thành', latitude: 'Vĩ độ', longitude: 'Kinh độ', openingTime: 'Mở cửa', closingTime: 'Đóng cửa' } as Record<string, string>)[key]}</dt><dd>{value == null ? 'Không cung cấp' : String(value)}</dd></div>)}</dl>
    {review.rejectionReason && <p>Lý do từ chối: {review.rejectionReason}</p>}
    {review.status === 'PENDING' && <form onSubmit={(event: FormEvent) => { event.preventDefault(); void decide(false); }}><label>Lý do từ chối (bắt buộc khi từ chối)<textarea required value={reason} onChange={event => setReason(event.target.value)} /></label><div className="owner-actions"><button type="button" disabled={busy} onClick={() => void decide(true)}>Duyệt hồ sơ</button><button type="submit" disabled={busy || !reason.trim()}>Từ chối hồ sơ</button></div></form>}
    {error && <p role="alert">{error}</p>}
  </article>;
}
function ReviewHistory({ facilityId, courtId, changed }: { facilityId: number; courtId?: number; changed: () => void }) {
  const [page, setPage] = useState(1);
  const path = `/api/v1/admin/facilities/${facilityId}${courtId ? `/courts/${courtId}` : ''}/reviews?page=${page}&limit=10`;
  const resource = useApiResource<{ data: FacilityReview[]; meta: { totalPages: number } }>(path, true);
  return <section><h2>{courtId ? 'Hồ sơ sân' : 'Hồ sơ cơ sở và địa chỉ'}</h2>{resource.loading && <p>Đang tải hồ sơ…</p>}{resource.error && <p role="alert">{resource.error}<button onClick={resource.reload}>Thử lại</button></p>}
    {resource.data?.data.length === 0 && <p>Chưa có hồ sơ duyệt.</p>}
    {resource.data?.data.map(review => <ReviewAttempt key={review.id} review={review} facilityId={facilityId} courtId={courtId} changed={() => { resource.reload(); changed(); }} />)}
    <div className="owner-actions"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}</span><button disabled={!resource.data || page >= resource.data.meta.totalPages} onClick={() => setPage(page + 1)}>Trang sau</button></div>
  </section>;
}
export function FacilityReviewPage() {
  const { facilityId } = useParams();
  const [selected, setSelected] = useState<number | undefined>();
  const resource = useApiResource<{ data: Facility }>(`/api/v1/admin/facilities/${facilityId}`);
  const facility = resource.data?.data;
  return <main className="owner-main"><Link to="/admin/courts">← Quản lý cơ sở</Link><h1>Duyệt hồ sơ cơ sở</h1>{resource.loading && <p>Đang tải…</p>}{resource.error && <p role="alert">{resource.error}<button onClick={resource.reload}>Thử lại</button></p>}
    {facility && <><section className="owner-card"><h2>{facility.name}</h2><p>Địa chỉ đang lưu: {[facility.address, facility.ward, facility.district, facility.city].filter(Boolean).join(', ')}</p><p>Trạng thái hiện tại: {facility.status}</p>
      <DataTable data={facility.courts ?? []} keyExtractor={court => court.id} columns={[{ key: 'name', header: 'Sân', render: court => court.name }, { key: 'status', header: 'Trạng thái', render: court => court.status }, { key: 'review', header: 'Duyệt', render: court => <button onClick={() => setSelected(court.id)}>Xem hồ sơ sân {court.name}</button> }]} />
    </section><ReviewHistory facilityId={Number(facilityId)} changed={resource.reload} />{selected && <ReviewHistory key={selected} facilityId={Number(facilityId)} courtId={selected} changed={resource.reload} />}</>}
  </main>;
}
