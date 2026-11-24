import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, ClipboardCheck, Inbox, RefreshCw } from 'lucide-react';
import { TimeRangeFilter } from '../../../components/common/TimeRangeFilter';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import { AdminHeader } from '../components/AdminHeader';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminMain } from '../components/AdminMain';
import { PageHeader } from '@/components/common/page-layout';
import { DataTable, type ColumnDef } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { FilterToolbar, type ActiveFilterChip, type FilterSelectConfig } from '@/components/common/filter-toolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Textarea } from '@/components/ui/textarea';
import { TablePagination } from '@/components/common/table-pagination';
import { ToastContainer, type ToastMessage } from '../components/Toast';
import { useAdminTimeRange } from '../contexts/admin-time-range-context';
import {
  facilityReviewQueuePath,
  facilityReviewService,
  type FacilityReviewQueueItem,
  type FacilityReviewQueuePage,
  type FacilityReviewStatus,
} from '../services/facility-review-service';

const FIELD_LABELS: Record<string, string> = {
  name: 'Tên',
  description: 'Mô tả',
  phone: 'Điện thoại',
  address: 'Địa chỉ',
  ward: 'Phường/xã',
  district: 'Quận/huyện',
  city: 'Tỉnh/thành',
  latitude: 'Vĩ độ',
  longitude: 'Kinh độ',
  openingTime: 'Mở cửa',
  closingTime: 'Đóng cửa',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
};

const STATUS_TONES: Record<string, string> = {
  PENDING: 'bg-caution-bg text-caution',
  APPROVED: 'bg-success-bg text-success',
  REJECTED: 'bg-danger-bg text-danger',
};

type ApprovalFilter = 'ALL' | 'FACILITY' | 'COURT';

const TARGET_LABELS: Record<ApprovalFilter, string> = {
  ALL: 'Tất cả loại hồ sơ',
  FACILITY: 'Cơ sở & đổi địa chỉ',
  COURT: 'Sân',
};

function reviewLabel(review: FacilityReviewQueueItem): string {
  if (review.kind === 'ADDRESS_CHANGE') return 'Đề xuất đổi địa chỉ';
  return review.courtId === null ? 'Hồ sơ cơ sở' : 'Hồ sơ sân';
}

function kindTone(review: FacilityReviewQueueItem): string {
  if (review.kind === 'ADDRESS_CHANGE') return 'bg-caution-bg text-caution';
  return review.courtId === null ? 'bg-success-bg text-success' : 'bg-info-bg text-info';
}

function targetName(review: FacilityReviewQueueItem): string {
  return review.courtId === null ? review.facilityName : `${review.facilityName} · ${review.courtName ?? `Sân #${review.courtId}`}`;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', { hour12: false });
}

function ReviewDetail({ review, onDecided, notify }: {
  review: FacilityReviewQueueItem;
  onDecided: () => void;
  notify: (type: 'success' | 'error', message: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const processed = review.status !== 'PENDING';
  const entries = Object.entries(review.submittedValues).filter(([key]) => key in FIELD_LABELS);

  async function decide(approve: boolean) {
    if (busy || (!approve && !reason.trim())) return;
    setBusy(true);
    setError('');
    try {
      await facilityReviewService.decide(review.facilityId, review, approve, reason, review.courtId ?? undefined);
      notify('success', approve ? `Đã duyệt ${targetName(review)}.` : `Đã từ chối ${targetName(review)}.`);
      onDecided();
    } catch {
      setError('Không thể gửi quyết định. Hồ sơ có thể đã thay đổi; hãy làm mới danh sách.');
    } finally {
      setBusy(false);
    }
  }

  return <div id={`review-detail-${review.id}`} className="flex flex-col gap-4 p-4 sm:p-5">
    <dl className="grid gap-3 rounded-lg bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-3">
      {entries.map(([key, value]) => <div key={key} className="min-w-0">
        <dt className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{FIELD_LABELS[key]}</dt>
        <dd className="mt-0.5 text-sm [overflow-wrap:anywhere]">{value == null || value === '' ? 'Không cung cấp' : String(value)}</dd>
      </div>)}
    </dl>

    {review.rejectionReason && <p className="rounded-lg bg-danger-bg p-3 text-sm text-danger">
      <strong>Lý do từ chối:</strong> {review.rejectionReason}
    </p>}

    {!processed && <div className="flex flex-col gap-3 rounded-lg bg-card p-4 shadow-sm">
      <label htmlFor={`review-reason-${review.id}`} className="flex flex-col gap-1.5 text-sm font-semibold">
        Lý do từ chối (bắt buộc khi từ chối)
        <Textarea id={`review-reason-${review.id}`} value={reason} maxLength={2000}
          onChange={event => setReason(event.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="brand" disabled={busy} onClick={() => void decide(true)}>
          {busy ? 'Đang xử lý…' : 'Duyệt hồ sơ'}
        </Button>
        <Button type="button" variant="danger-soft" disabled={busy || !reason.trim()} onClick={() => void decide(false)}>
          Từ chối
        </Button>
      </div>
    </div>}
  </div>;
}

export function FacilityApprovalPage() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filter, setFilter] = useState<ApprovalFilter>('ALL');
  const [status, setStatus] = useState<FacilityReviewStatus | ''>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { range, setRange } = useAdminTimeRange();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const resource = useApiResource<FacilityReviewQueuePage>(
    facilityReviewQueuePath({
      page,
      limit,
      sort,
      search: debouncedSearch || undefined,
      status: status || undefined,
      target: filter === 'ALL' ? undefined : filter,
      range,
    }),
  );
  const items = resource.data?.data ?? [];
  const total = resource.data?.meta.total ?? 0;
  const totalPages = resource.data?.meta.totalPages ?? 1;

  const notify = (type: 'success' | 'error', message: string) => {
    const id = String(Date.now());
    setToasts(current => [...current, { id, type, message }]);
    window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 4000);
  };

  const handleDecided = () => {
    if (items.length === 1 && page > 1) {
      setPage(page - 1);
      return;
    }
    resource.reload();
  };

  const toggleExpanded = (id: number) => {
    setExpandedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setFilter('ALL');
    setPage(1);
  };

  const summaryLabel = status ? STATUS_LABELS[status] : 'Tất cả trạng thái';
  const filters: FilterSelectConfig[] = [
    { id: 'sort', value: sort, ariaLabel: 'Sắp xếp hồ sơ', options: [
      { value: 'newest', label: 'Mới nhất trước' },
      { value: 'oldest', label: 'Cũ nhất trước' },
    ], onChange: value => { setSort(value as 'newest' | 'oldest'); setPage(1); } },
    {
      id: 'status',
      value: status,
      placeholder: 'Tất cả trạng thái',
      ariaLabel: 'Lọc theo trạng thái yêu cầu',
      options: [
        { value: 'PENDING', label: 'Chờ duyệt' },
        { value: 'APPROVED', label: 'Đã duyệt' },
        { value: 'REJECTED', label: 'Bị từ chối' },
      ],
      onChange: value => { setStatus(value as FacilityReviewStatus | ''); setPage(1); },
    },
    {
      id: 'target',
      value: filter === 'ALL' ? '' : filter,
      placeholder: 'Tất cả loại hồ sơ',
      ariaLabel: 'Lọc theo loại hồ sơ',
      options: [
        { value: 'FACILITY', label: 'Cơ sở & đổi địa chỉ' },
        { value: 'COURT', label: 'Sân' },
      ],
      onChange: value => { setFilter((value || 'ALL') as ApprovalFilter); setPage(1); },
    },
  ];

  const activeChips: ActiveFilterChip[] = [];
  if (status) activeChips.push({
    id: 'status',
    label: `Trạng thái: ${STATUS_LABELS[status]}`,
    onRemove: () => { setStatus(''); setPage(1); },
  });
  if (filter !== 'ALL') activeChips.push({
    id: 'target',
    label: `Loại: ${TARGET_LABELS[filter]}`,
    onRemove: () => { setFilter('ALL'); setPage(1); },
  });

  const columns: ColumnDef<FacilityReviewQueueItem>[] = [
    {
      key: 'review', header: 'HỒ SƠ', minWidth: 260, render: review =>
        <div className="space-y-1">
          <p className="font-bold">{targetName(review)}</p>
          <p className="text-xs text-muted-foreground">Hồ sơ #{review.id}</p>
        </div>,
    },
    {
      key: 'kind', header: 'LOẠI', minWidth: 180, render: review =>
        <Badge className={kindTone(review)}>{reviewLabel(review)}</Badge>,
    },
    {
      key: 'status', header: 'TRẠNG THÁI', minWidth: 150, render: review =>
        <Badge className={STATUS_TONES[review.status] ?? 'bg-muted text-muted-foreground'}>
          {STATUS_LABELS[review.status] ?? review.status}
        </Badge>,
    },
    {
      key: 'submittedAt', header: 'GỬI LÚC', minWidth: 170, render: review =>
        <span className="text-muted-foreground">{formatDateTime(review.submittedAt)}</span>,
    },
    {
      key: 'reviewedAt', header: 'XỬ LÝ', minWidth: 200, render: review => review.status === 'PENDING' ? <span className="text-muted-foreground">—</span> :
        <div className="space-y-1">
          <p>{formatDateTime(review.reviewedAt)}</p>
          {review.rejectionReason && <p className="max-w-56 truncate text-xs text-danger" title={review.rejectionReason}>Lý do: {review.rejectionReason}</p>}
        </div>,
    },
    {
      key: 'actions', header: 'THAO TÁC', minWidth: 220, render: review => {
        const expanded = expandedIds.has(review.id);
        return <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="h-9 px-3" aria-expanded={expanded}
            aria-controls={`review-detail-${review.id}`} onClick={() => toggleExpanded(review.id)}>
            {expanded ? 'Thu gọn' : 'Chi tiết'}
          </Button>
          <Link to={`/admin/courts/${review.facilityId}/reviews`} className={buttonVariants({ variant: 'ghost', className: 'h-9 px-3 text-primary' })}>
            Hồ sơ
          </Link>
        </div>;
      },
    },
  ];

  return (
    <div className="flex min-h-svh bg-background font-sans text-foreground">
      <ToastContainer toasts={toasts} onRemove={id => setToasts(current => current.filter(toast => toast.id !== id))} />
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />
      <AdminMain isCollapsed={isCollapsed}>
        <AdminHeader isCollapsed={isCollapsed} onToggleMobileSidebar={() => setIsMobileOpen(!isMobileOpen)} />
        <main id="admin-main-content" tabIndex={-1}
          className="mx-auto flex w-full min-w-0 max-w-360 flex-col gap-6 px-4 pb-16 pt-24 sm:px-6">
          <PageHeader
            title="Duyệt cơ sở & sân"
            description="Xử lý hồ sơ đăng ký cơ sở, đăng ký sân và đề xuất đổi địa chỉ. Bộ lọc thời gian dùng chung với Bảng điều khiển."
            actions={<Button type="button" variant="outline" onClick={resource.reload} disabled={resource.loading}>
              <RefreshCw aria-hidden="true" />
              Làm mới
            </Button>}
          />

          <section aria-label="Tổng quan hàng đợi duyệt"
            className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-4">
              <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <ClipboardCheck className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Tổng hồ sơ · {summaryLabel}</p>
                <p className="text-2xl font-extrabold tracking-tight tabular-nums text-primary">{total}</p>
              </div>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Chọn trạng thái “Tất cả” để xem cả hồ sơ đã duyệt và đã từ chối. Từ chối bắt buộc nhập lý do để chủ sân chỉnh sửa và gửi lại.
            </p>
          </section>

          <FilterToolbar
            search={{ value: search, onChange: setSearch, placeholder: 'Tìm theo tên cơ sở hoặc sân' }}
            filters={filters}
            rightActions={<div className="col-span-full min-w-0 xl:w-full xl:basis-full"><TimeRangeFilter layout="inline" value={range} onChange={value => { setRange(value); setPage(1); }}
              disabled={resource.loading} label="Thời gian gửi" /></div>}
            activeChips={activeChips}
            totalCount={total}
            totalCountLabel="hồ sơ"
            onClearAll={clearFilters}
          />

          <section aria-labelledby="approval-queue-heading" className="flex min-w-0 flex-col gap-3">
            <h2 id="approval-queue-heading" className="text-lg font-bold tracking-tight">Hàng đợi duyệt</h2>
            {resource.loading && <p role="status" className="sr-only">Đang tải hồ sơ…</p>}
            {resource.error ? (
              <EmptyState role="alert" icon={CircleAlert} title="Không tải được hồ sơ"
                description={resource.error} action={{ label: 'Thử lại', onClick: resource.reload }} />
            ) : (
              <DataTable
                data={items}
                columns={columns}
                keyExtractor={review => review.id}
                isLoading={resource.loading}
                emptyState={<div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Inbox aria-hidden="true" className="size-6" />
                  <p className="text-sm font-semibold text-foreground">Không có hồ sơ phù hợp</p>
                  <p className="text-sm">Thử đổi trạng thái, loại hồ sơ hoặc khoảng thời gian.</p>
                </div>}
                renderExpandedRow={review => expandedIds.has(review.id)
                  ? <ReviewDetail review={review} onDecided={handleDecided} notify={notify} />
                  : null}
              />
            )}
          </section>

          {total > 0 && (
            <TablePagination
              page={page}
              limit={limit}
              total={total}
              totalPages={totalPages}
              totalLabel="hồ sơ"
              onPageChange={setPage}
              onLimitChange={next => { setLimit(next); setPage(1); }}
            />
          )}
        </main>
      </AdminMain>
    </div>
  );
}
