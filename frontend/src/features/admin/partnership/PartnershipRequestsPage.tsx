import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/common/data-table';
import { PageHeader } from '@/components/common/page-layout';
import { TablePagination } from '@/components/common/table-pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/shared/api/http-client';
import { cn } from '@/shared/utils/cn';
import { adminOwnerRequestApi, OWNER_REQUEST_STATUS_LABELS, type OwnerRequest, type OwnerRequestCounts, type OwnerRequestStatus } from '@/features/partnership/partnership-api';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminHeader } from '../components/AdminHeader';
import { AdminMain } from '../components/AdminMain';
import { ToastContainer, type ToastMessage } from '../components/Toast';
import { ApproveRequestDialog, RejectRequestDialog } from './partnership-dialogs';
import { PartnershipRequestDetail, StatusBadge } from './partnership-detail';
import { formatDateTime } from './partnership-format';

const TABS: Array<{ value: OwnerRequestStatus | ''; label: string }> = [
  { value: 'PENDING', label: OWNER_REQUEST_STATUS_LABELS.PENDING },
  { value: 'CONTACTED', label: OWNER_REQUEST_STATUS_LABELS.CONTACTED },
  { value: 'APPROVED', label: OWNER_REQUEST_STATUS_LABELS.APPROVED },
  { value: 'REJECTED', label: OWNER_REQUEST_STATUS_LABELS.REJECTED },
  { value: '', label: 'Tất cả' },
];
const EMPTY_COUNTS: OwnerRequestCounts = { PENDING: 0, CONTACTED: 0, APPROVED: 0, REJECTED: 0 };
const STALE_MESSAGE = 'Yêu cầu vừa được quản trị viên khác xử lý. Đã tải lại trạng thái mới nhất.';

/** Admin queue "Yêu cầu hợp tác" at /admin/partnership-requests (PRD §6.2, §9). `?id=` opens a request. */
export function PartnershipRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = Number(searchParams.get('id')) || null;
  const [status, setStatus] = useState<OwnerRequestStatus | ''>('PENDING');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [rows, setRows] = useState<OwnerRequest[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, counts: EMPTY_COUNTS });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState<OwnerRequest | null>(null);
  // The detail follows `?id=`; a request loaded for another id is not shown.
  const selected = loaded && loaded.id === selectedId ? loaded : null;
  const [approveTarget, setApproveTarget] = useState<OwnerRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<OwnerRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(current => [...current, { id, type, message }]);
    setTimeout(() => setToasts(current => current.filter(item => item.id !== id)), 4000);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { setQ(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminOwnerRequestApi.list({ status, q, page, limit });
      setRows(result.data);
      setMeta({ total: result.meta.total, totalPages: result.meta.totalPages, counts: result.meta.counts ?? EMPTY_COUNTS });
    } catch {
      toast('error', 'Không thể tải danh sách yêu cầu hợp tác.');
    } finally {
      setLoading(false);
    }
  }, [status, q, page, limit, toast]);

  useEffect(() => { void load(); }, [load]);

  const loadSelected = useCallback(async (id: number) => {
    try {
      setLoaded((await adminOwnerRequestApi.get(id)).data);
    } catch (reason) {
      setLoaded(null);
      toast('error', reason instanceof ApiError && reason.code === 'OWNER_REQUEST_NOT_FOUND' ? 'Không tìm thấy yêu cầu hợp tác.' : 'Không thể tải chi tiết yêu cầu.');
    }
  }, [toast]);

  useEffect(() => {
    if (selectedId !== null && loaded?.id !== selectedId) void loadSelected(selectedId);
  }, [selectedId, loaded?.id, loadSelected]);

  const select = (id: number | null) => setSearchParams(current => {
    const next = new URLSearchParams(current);
    if (id === null) next.delete('id'); else next.set('id', String(id));
    return next;
  });

  const applyUpdate = async (updated: OwnerRequest, message: string) => {
    setLoaded(updated);
    toast('success', message);
    await load();
  };

  const handleStale = async () => {
    setApproveTarget(null);
    setRejectTarget(null);
    toast('error', STALE_MESSAGE);
    if (selectedId) await loadSelected(selectedId);
    await load();
  };

  const run = async (action: () => Promise<{ data: OwnerRequest }>, message: string) => {
    setBusy(true);
    try {
      await applyUpdate((await action()).data, message);
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'OWNER_REQUEST_INVALID_STATE') await handleStale();
      else toast('error', 'Không thể cập nhật yêu cầu. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<OwnerRequest>[] = [
    { key: 'status', header: 'Trạng thái', minWidth: 140, render: item => <StatusBadge status={item.status} /> },
    { key: 'contact', header: 'Người liên hệ', minWidth: 220, render: item => <div className="space-y-1"><p className="font-semibold">{item.contactName}</p><p className="text-muted-foreground">{item.email}</p><p className="text-muted-foreground">{item.phone}</p></div> },
    { key: 'facility', header: 'Cơ sở', minWidth: 220, render: item => <div className="space-y-1"><p className="font-semibold">{item.facilityName}</p><p className="text-muted-foreground">{item.expectedCourts} sân</p></div> },
    { key: 'city', header: 'Khu vực', minWidth: 180, render: item => <div className="space-y-1"><p>{item.district}</p><p className="text-muted-foreground">{item.city}</p></div> },
    { key: 'createdAt', header: 'Gửi lúc', minWidth: 150, render: item => formatDateTime(item.createdAt) },
    // Keyboard and screen-reader access to the detail (the row click is a mouse shortcut).
    { key: 'open', header: <span className="sr-only">Thao tác</span>, minWidth: 110, render: item => <Button variant="outline" className="h-10"
      aria-label={`Xem yêu cầu của ${item.contactName}`} onClick={event => { event.stopPropagation(); select(item.id); }}>Xem</Button> },
  ];

  return <div className="flex min-h-svh bg-background font-sans text-foreground">
    <ToastContainer toasts={toasts} onRemove={id => setToasts(current => current.filter(item => item.id !== id))} />
    <AdminSidebar isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} isMobileOpen={isMobileOpen} onMobileClose={() => setIsMobileOpen(false)} />
    <AdminMain isCollapsed={isCollapsed}>
      <AdminHeader isCollapsed={isCollapsed} onToggleMobileSidebar={() => setIsMobileOpen(!isMobileOpen)} />
      <main id="admin-main-content" tabIndex={-1} className="mx-auto flex w-full min-w-0 max-w-360 flex-col gap-6 px-4 pb-16 pt-24 sm:px-6">
        <PageHeader title="Yêu cầu hợp tác" description="Gọi điện xác minh chủ sân trước khi tạo tài khoản. Chủ sân tự đặt mật khẩu qua email." />
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div role="group" aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-2">
            {TABS.map(tab => {
              const active = status === tab.value;
              const count = tab.value ? meta.counts[tab.value] : undefined;
              return <button key={tab.value || 'ALL'} type="button" aria-pressed={active} onClick={() => { setStatus(tab.value); setPage(1); }}
                className={cn('inline-flex min-h-11 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'border-primary bg-accent text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground')}>
                {tab.label}{count !== undefined && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">{count}</span>}
              </button>;
            })}
          </div>
          <div className="relative w-full xl:w-80">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Tìm theo tên, email, số điện thoại hoặc cơ sở" placeholder="Tìm tên, email, SĐT, cơ sở…" className="pl-10"
              value={searchInput} onChange={event => setSearchInput(event.target.value)} />
          </div>
        </div>
        <div className={cn('grid min-w-0 gap-6', selected && 'lg:grid-cols-[minmax(0,1fr)_26rem]')}>
          <div className="flex min-w-0 flex-col gap-4">
            <DataTable scrollable data={rows} columns={columns} keyExtractor={item => item.id} isLoading={loading}
              onRowClick={item => select(item.id)} rowClassName={item => cn('cursor-pointer', item.id === selected?.id && 'bg-accent')}
              emptyState={<p className="text-sm text-muted-foreground">Không có yêu cầu phù hợp.</p>} />
            <TablePagination page={page} limit={limit} total={meta.total} totalPages={meta.totalPages} totalLabel="yêu cầu" onPageChange={setPage} onLimitChange={value => { setLimit(value); setPage(1); }} />
          </div>
          {selected && <PartnershipRequestDetail key={`${selected.id}-${selected.updatedAt}`} request={selected} busy={busy} onClose={() => select(null)}
            onSaveNote={note => void run(() => adminOwnerRequestApi.saveNote(selected.id, note), 'Đã lưu ghi chú.')}
            onContact={() => void run(() => adminOwnerRequestApi.markContacted(selected.id), 'Đã đánh dấu đã liên hệ.')}
            onApprove={() => setApproveTarget(selected)} onReject={() => setRejectTarget(selected)} />}
        </div>
      </main>
      {approveTarget && <ApproveRequestDialog key={approveTarget.id} request={approveTarget} onClose={() => setApproveTarget(null)} onStale={() => void handleStale()}
        onDone={updated => { setApproveTarget(null); void applyUpdate(updated, `Đã tạo tài khoản chủ sân ${updated.createdUser?.email ?? updated.email}.`); }} />}
      {rejectTarget && <RejectRequestDialog key={rejectTarget.id} request={rejectTarget} onClose={() => setRejectTarget(null)} onStale={() => void handleStale()}
        onDone={updated => { setRejectTarget(null); void applyUpdate(updated, 'Đã từ chối yêu cầu và gửi email cho người yêu cầu.'); }} />}
    </AdminMain>
  </div>;
}
