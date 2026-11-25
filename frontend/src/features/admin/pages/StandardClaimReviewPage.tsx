import { DataTable, type ColumnDef } from '@/components/common/data-table';
import { useCallback, useEffect, useState } from 'react';
import { FileImage } from 'lucide-react';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminHeader } from '../components/AdminHeader';
import { AdminMain } from '../components/AdminMain';
import { PageHeader } from '@/components/common/page-layout';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AdminDialog, AdminDialogFooter } from '../components/AdminDialog';
import { TablePagination } from '@/components/common/table-pagination';
import { ToastContainer, type ToastMessage } from '../components/Toast';
import { adminStandardService, type StandardClaimItem } from '../services/adminStandardService';

const statusOptions = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'VERIFIED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Bị từ chối' },
  { value: 'INVALIDATED', label: 'Mất hiệu lực' },
];

export function StandardClaimReviewPage() {
  const [claims, setClaims] = useState<StandardClaimItem[]>([]);
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [target, setTarget] = useState<{ claim: StandardClaimItem; approve: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toast = (type: 'success' | 'error', message: string) => {
    const id = String(Date.now());
    setToasts(current => [...current, { id, type, message }]);
    setTimeout(() => setToasts(current => current.filter(item => item.id !== id)), 4000);
  };

  const load = useCallback(async () => {
    try {
      const result = await adminStandardService.list(status, page, limit);
      setClaims(result.data);
      setMeta({ total: result.meta.total, totalPages: result.meta.totalPages });
    } catch (err: any) {
      toast('error', err.message || 'Không thể tải hồ sơ tiêu chuẩn');
    }
  }, [status, page, limit]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [status]);

  const decide = async () => {
    if (!target) return;
    if (!target.approve && !reason.trim()) { setError('Cần lý do từ chối.'); return; }
    setBusy(true);
    setError('');
    try {
      await adminStandardService.decide(target.claim.id, target.approve, reason.trim() || undefined);
      toast('success', target.approve ? 'Đã duyệt hồ sơ tiêu chuẩn.' : 'Đã từ chối hồ sơ tiêu chuẩn.');
      setTarget(null);
      setReason('');
      await load();
    } catch (err: any) {
      setError(err.message || 'Không thể xử lý hồ sơ');
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<StandardClaimItem>[] = [
    { key: 'facility', header: 'Cơ sở / Sân', minWidth: 220, render: claim => <div className="space-y-1"><p className="font-semibold">{claim.facilityName}</p><p className="text-muted-foreground">{claim.courtName}</p></div> },
    { key: 'standard', header: 'Tiêu chuẩn', minWidth: 260, render: claim => <p className="font-semibold">{claim.standardName}</p> },
    { key: 'surface', header: 'Thương hiệu / Dòng sản phẩm', minWidth: 220, render: claim => <div className="space-y-1"><p>{claim.surfaceBrand}</p><p className="text-muted-foreground">{claim.surfaceModel}</p></div> },
    { key: 'issuer', header: 'Đơn vị cấp / Số tham chiếu', minWidth: 280, render: claim => <div className="max-w-80 space-y-1 break-words"><p>{claim.issuer}</p><p className="text-muted-foreground">{claim.referenceNo}</p></div> },
    { key: 'validity', header: 'Hiệu lực', minWidth: 180, render: claim => <div className="space-y-1"><p>Từ: {claim.issuedAt ?? 'Chưa khai báo'}</p><p>Đến: {claim.expiresAt ?? 'Không thời hạn'}</p></div> },
    { key: 'status', header: 'Trạng thái', minWidth: 160, render: claim => <Badge>{{ PENDING: 'Chờ duyệt', VERIFIED: 'Đã duyệt', REJECTED: 'Bị từ chối', INVALIDATED: 'Mất hiệu lực' }[claim.status] ?? claim.status}</Badge> },
    { key: 'evidence', header: 'Bằng chứng', minWidth: 180, render: claim => <div className="flex flex-col items-start gap-2">{claim.evidenceMediaIds.length ? claim.evidenceMediaIds.map((id, index) => <a key={id} className="inline-flex items-center gap-1 text-primary underline" href={`/api/v1/media/${id}`} target="_blank" rel="noreferrer"><FileImage aria-hidden="true" className="size-4" />Ảnh {index + 1}</a>) : <span className="text-muted-foreground">Chưa có ảnh</span>}</div> },
    { key: 'reason', header: 'Lý do từ chối', minWidth: 220, render: claim => <p className="max-w-72 whitespace-pre-wrap break-words text-muted-foreground">{claim.rejectionReason ?? '—'}</p> },
    { key: 'actions', header: 'Thao tác', minWidth: 180, render: claim => claim.status === 'PENDING' ? <div className="flex gap-2"><Button disabled={busy} onClick={() => { setTarget({ claim, approve: true }); setReason(''); setError(''); }}>Duyệt</Button><Button variant="danger-soft" disabled={busy} onClick={() => { setTarget({ claim, approve: false }); setReason(''); setError(''); }}>Từ chối</Button></div> : <span className="text-muted-foreground">Đã xử lý</span> },
  ];

  return <div className="flex min-h-svh bg-background font-sans text-foreground">
    <ToastContainer toasts={toasts} onRemove={id => setToasts(current => current.filter(item => item.id !== id))} />
    <AdminSidebar isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} isMobileOpen={isMobileOpen} onMobileClose={() => setIsMobileOpen(false)} />
    <AdminMain isCollapsed={isCollapsed}>
      <AdminHeader isCollapsed={isCollapsed} onToggleMobileSidebar={() => setIsMobileOpen(!isMobileOpen)} />
      <main id="admin-main-content" tabIndex={-1} className="mx-auto flex w-full min-w-0 max-w-360 flex-col gap-6 px-4 pb-16 pt-24 sm:px-6">
        <PageHeader title="Duyệt tiêu chuẩn mặt sân" description="Chỉ duyệt khi bằng chứng, thương hiệu/dòng sản phẩm và thời hạn khớp với tiêu chuẩn." />
        <div className="max-w-64"><Select aria-label="Lọc trạng thái hồ sơ tiêu chuẩn" value={status} onChange={setStatus} options={statusOptions} /></div>
        <DataTable scrollable data={claims} columns={columns} keyExtractor={claim => claim.id}
          emptyState={<p className="text-sm text-muted-foreground">Không có hồ sơ phù hợp.</p>} />
        <TablePagination page={page} limit={limit} total={meta.total} totalPages={meta.totalPages} totalLabel="hồ sơ" onPageChange={setPage} onLimitChange={setLimit} />
      </main>
      <AdminDialog open={target !== null} onClose={() => setTarget(null)} title={target?.approve ? 'Duyệt hồ sơ tiêu chuẩn' : 'Từ chối hồ sơ tiêu chuẩn'} description={target?.claim.standardName}>
        <p className="text-sm">Sân: <strong>{target?.claim.courtName}</strong> · {target?.claim.surfaceBrand} {target?.claim.surfaceModel}</p>
        {!target?.approve && <label className="mt-4 flex flex-col gap-2 text-sm font-semibold">Lý do từ chối *<Textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} /></label>}
        {target?.approve && <p className="mt-4 rounded-lg bg-caution-bg p-4 text-sm text-caution">Hãy đối chiếu bằng chứng với danh sách chứng nhận trước khi duyệt. Nhãn sẽ hiển thị công khai đến ngày hết hạn.</p>}
        {error && <p className="mt-3 rounded-lg bg-danger-bg p-3 text-sm text-danger" role="alert">{error}</p>}
        <AdminDialogFooter><Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>Hủy</Button><Button onClick={() => void decide()} disabled={busy}>{busy ? 'Đang xử lý…' : target?.approve ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}</Button></AdminDialogFooter>
      </AdminDialog>
    </AdminMain>
  </div>;
}
