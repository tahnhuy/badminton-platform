import { AuditScrollArea } from '@/components/common/audit-scroll-area';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { httpClient } from '@/shared/api/http-client';
import { Button } from '@/components/ui/button';
import { ContentPanel } from './content-panel';
import { OwnerForm } from '@/features/court-owner/components/OwnerForm';

type Attempt = { id: number; facilityId: number; ownerId: number; evidence: string; status: string; reason: string | null };
type Preview = { facility: { name: string; address: string; openingTime: string; closingTime: string }; courts: { id: number; name: string; status: string; pricing: { id: number; startTime: string; endTime: string; price: string; validFrom: string; validTo: string | null }[] }[] };
const statusLabels: Record<string, string> = { PENDING: 'Chờ Admin xác minh', APPROVED: 'Đã tiếp nhận, chờ xác nhận dữ liệu', REJECTED: 'Bị từ chối', CONFIRMED: 'Đã xác nhận dữ liệu' };
export function FacilityHandoverPanel({ admin = false, changed }: { admin?: boolean; changed?: () => void }) {
  const root = admin ? '/api/v1/admin/facilities/handovers' : '/api/v1/owner/facility-handovers';
  const [rows, setRows] = useState<{ handover: Attempt; facilityName: string }[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ id: number; data: Preview } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void httpClient<{ data: { data: typeof rows; hasMore: boolean } }>(`${root}?page=${page}&limit=10`, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(result?.data?.data)) throw new Error('Không tải được danh sách yêu cầu tiếp nhận cơ sở.');
      setRows(result.data.data);
      setHasMore(result.data.hasMore);
      setError('');
    }).catch(reason => {
      if (controller.signal.aborted) return;
      setRows([]);
      setHasMore(false);
      setError(reason instanceof Error ? reason.message : 'Không tải được yêu cầu.');
    });
    return () => controller.abort();
  }, [root, page, revision]);
  async function run(operation: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await operation(); setMessage(success); setRevision(value => value + 1); changed?.(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Thao tác thất bại.'); }
    finally { setBusy(false); }
  }
  function post(path: string, body: unknown) { return httpClient(root + path, { method: 'POST', body: JSON.stringify(body) }); }
  return <ContentPanel title={admin ? 'Yêu cầu tiếp nhận cơ sở nhập' : 'Tiếp nhận cơ sở đã có trên hệ thống'}>
    <p className="text-sm text-muted-foreground">{admin ? 'Chỉ duyệt sau khi kiểm tra bằng chứng quyền quản lý bên ngoài hệ thống. Duyệt chuyển quyền quản lý; Owner vẫn phải kiểm tra sân, giá và giờ hoạt động trước khi xác nhận dữ liệu.' : 'Gửi mã cơ sở dạng số và thông tin chứng minh quyền quản lý để Admin kiểm tra. Yêu cầu chưa được duyệt không cấp quyền truy cập cơ sở.'}</p>
    {!admin && <OwnerForm fields={[{ name: 'facilityId', label: 'ID cơ sở cần tiếp nhận', type: 'number', required: true }, { name: 'evidence', label: 'Thông tin chứng minh quyền quản lý và cách liên hệ xác minh (ít nhất 10 ký tự)', type: 'textarea', required: true }]} title="Gửi yêu cầu tiếp nhận" busy={busy} submit={values => void run(() => post('', values), 'Đã gửi yêu cầu tiếp nhận.')} />}
    {error && <p role="alert" className="text-destructive">{error}</p>}{message && <p role="status">{message}</p>}
    <AuditScrollArea label="Lịch sử yêu cầu tiếp nhận cơ sở">{rows.map(({ handover: row, facilityName }) => <section key={row.id} className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="font-semibold">{facilityName} · Cơ sở #{row.facilityId}</h3><p>{statusLabels[row.status]}</p>
      {admin && <><p>Owner yêu cầu: #{row.ownerId}</p><p className="whitespace-pre-wrap break-words">{row.evidence}</p></>}
      {row.reason && <p className="whitespace-pre-wrap break-words">Ghi chú Admin: {row.reason}</p>}
      {admin && row.status === 'PENDING' && <OwnerForm fields={[{ name: 'reason', label: 'Kết quả xác minh / lý do quyết định (ít nhất 10 ký tự)', type: 'textarea', required: true }, { name: 'decision', label: 'Nhập DUYET để duyệt, TU_CHOI để từ chối', required: true }]} title="Lưu quyết định" busy={busy} submit={values => {
        if (!['DUYET', 'TU_CHOI'].includes(String(values.decision))) { setError('Nhập DUYET hoặc TU_CHOI.'); return; }
        void run(() => post(`/${row.id}/decision`, { approve: values.decision === 'DUYET', reason: values.reason }), 'Đã xử lý yêu cầu.');
      }} />}
      {!admin && row.status === 'APPROVED' && <Button variant="outline" disabled={busy} onClick={() => void run(async () => { const result = await httpClient<{ data: Preview }>(`${root}/${row.id}/preview`); setPreview({ id: row.id, data: result.data }); setAcknowledged(false); }, 'Hãy kiểm tra toàn bộ dữ liệu bên dưới trước khi xác nhận.')}>Kiểm tra và xác nhận dữ liệu</Button>}
    </section>)}</AuditScrollArea>
    {!rows.length && <p>Chưa có yêu cầu.</p>}
    <div className="flex gap-2"><Button variant="outline" disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)}>Trang trước</Button><Button variant="outline" disabled={busy || !hasMore} onClick={() => setPage(value => value + 1)}>Trang sau</Button></div>
    {preview && <section className="space-y-4 rounded-lg border border-border p-4"><h3 className="font-semibold">Xác nhận: {preview.data.facility.name}</h3><p>{preview.data.facility.address}</p><p>Giờ hoạt động: {preview.data.facility.openingTime} – {preview.data.facility.closingTime}</p>
      <p>Đối chiếu số sân thực tế và từng mức giá. Nếu chưa đúng, sửa ở quản lý cơ sở và <Link className="underline" to="/owner/pricing">quản lý giá</Link>, sau đó tải lại bản kiểm tra.</p>
      {preview.data.courts.map(court => <div key={court.id}><p className="font-semibold">{court.name} ({court.status})</p>{court.pricing.map(price => <p key={price.id}>{price.startTime} – {price.endTime}: {Number(price.price).toLocaleString('vi-VN')} đ/giờ · {price.validFrom} → {price.validTo ?? 'Không giới hạn'}</p>)}{!court.pricing.length && <p>Chưa có giá.</p>}</div>)}
      <label className="flex items-start gap-2"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={busy} /><span>Tôi đã đối chiếu và xác nhận địa chỉ, giờ hoạt động, danh sách sân và giá trên đây là chính xác. Dữ liệu được xác nhận có thể được dùng để nhận booking khi các điều kiện vận hành khác cho phép.</span></label>
      <Button disabled={busy || !acknowledged} onClick={() => void run(async () => { await post(`/${preview.id}/confirm`, { acknowledged: true, snapshot: preview.data }); setPreview(null); }, 'Đã xác nhận dữ liệu cơ sở và các sân.')}>Xác nhận dữ liệu thực tế</Button>
    </section>}
  </ContentPanel>;
}
