import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchIcon, SyncIcon } from '../../../components/common/Icons';
import { TimeRangeFilter } from '../../../components/common/TimeRangeFilter';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import { AdminHeader } from '../components/AdminHeader';
import { AdminSidebar } from '../components/AdminSidebar';
import { TablePagination } from '../components/TablePagination';
import { ToastContainer, type ToastMessage } from '../components/Toast';
import { useAdminTimeRange } from '../contexts/admin-time-range-context';
import {
  facilityReviewQueuePath,
  facilityReviewService,
  type FacilityReviewQueueItem,
  type FacilityReviewQueuePage,
  type FacilityReviewStatus,
} from '../services/facility-review-service';
import './facility-approval.css';

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

type ApprovalFilter = 'ALL' | 'FACILITY' | 'COURT';

function reviewLabel(review: FacilityReviewQueueItem): string {
  if (review.kind === 'ADDRESS_CHANGE') return 'Đề xuất đổi địa chỉ';
  return review.courtId === null ? 'Hồ sơ cơ sở' : 'Hồ sơ sân';
}

function targetName(review: FacilityReviewQueueItem): string {
  return review.courtId === null ? review.facilityName : `${review.facilityName} · ${review.courtName ?? `Sân #${review.courtId}`}`;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', { hour12: false });
}

function ReviewRow({ review, onDecided, notify }: {
  review: FacilityReviewQueueItem;
  onDecided: () => void;
  notify: (type: 'success' | 'error', message: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
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

  return (
    <>
      <tr className={expanded ? 'approval-row-expanded' : undefined}>
        <td>
          <strong>{targetName(review)}</strong>
          <div className="approval-row-sub">Hồ sơ #{review.id}</div>
        </td>
        <td>
          <span className={`approval-kind approval-kind-${review.kind === 'ADDRESS_CHANGE' ? 'address' : review.courtId === null ? 'facility' : 'court'}`}>
            {reviewLabel(review)}
          </span>
        </td>
        <td>
          <span className={`approval-status approval-status-${review.status.toLowerCase()}`}>
            {STATUS_LABELS[review.status] ?? review.status}
          </span>
        </td>
        <td>{formatDateTime(review.submittedAt)}</td>
        <td>
          {processed ? (
            <>
              <div>{formatDateTime(review.reviewedAt)}</div>
              {review.rejectionReason && (
                <div className="approval-row-reason" title={review.rejectionReason}>Lý do: {review.rejectionReason}</div>
              )}
            </>
          ) : '—'}
        </td>
        <td>
          <div className="approval-row-actions">
            <button type="button" onClick={() => setExpanded(value => !value)}>
              {expanded ? 'Thu gọn' : 'Chi tiết'}
            </button>
            <Link to={`/admin/courts/${review.facilityId}/reviews`}>Hồ sơ</Link>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="approval-detail-row">
          <td colSpan={6}>
            <dl className="approval-fields">
              {entries.map(([key, value]) => (
                <div key={key}>
                  <dt>{FIELD_LABELS[key]}</dt>
                  <dd>{value == null || value === '' ? 'Không cung cấp' : String(value)}</dd>
                </div>
              ))}
            </dl>

            {review.rejectionReason && (
              <p className="approval-reason"><strong>Lý do từ chối:</strong> {review.rejectionReason}</p>
            )}

            {!processed && (
              <div className="approval-actions">
                <label>
                  Lý do từ chối (bắt buộc khi từ chối)
                  <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} />
                </label>
                <div>
                  <button type="button" className="approval-approve" disabled={busy} onClick={() => void decide(true)}>
                    {busy ? 'Đang xử lý…' : 'Duyệt hồ sơ'}
                  </button>
                  <button type="button" className="approval-reject" disabled={busy || !reason.trim()} onClick={() => void decide(false)}>
                    Từ chối
                  </button>
                </div>
                {error && <p role="alert">{error}</p>}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function FacilityApprovalPage() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filter, setFilter] = useState<ApprovalFilter>('ALL');
  const [status, setStatus] = useState<FacilityReviewStatus | ''>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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

  const summaryLabel = status ? STATUS_LABELS[status] : 'Tất cả trạng thái';

  return (
    <div className="admin-layout">
      <ToastContainer toasts={toasts} onRemove={id => setToasts(current => current.filter(toast => toast.id !== id))} />
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />
      <div className={`admin-main-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <AdminHeader isCollapsed={isCollapsed} onToggleMobileSidebar={() => setIsMobileOpen(!isMobileOpen)} />
        <main className="approval-main">
          <div className="page-top-header">
            <div className="page-top-header-info">
              <h1 className="page-top-header-title">Duyệt cơ sở &amp; sân</h1>
              <p className="page-top-header-desc">
                Xử lý hồ sơ đăng ký cơ sở, đăng ký sân và đề xuất đổi địa chỉ. Bộ lọc thời gian dùng chung với Bảng điều khiển.
              </p>
            </div>
            <button type="button" className="approval-refresh" onClick={resource.reload} disabled={resource.loading}>
              <SyncIcon size={16} />
              Làm mới
            </button>
          </div>

          <section className="approval-summary">
            <div>
              <span>Tổng hồ sơ · {summaryLabel}</span>
              <strong>{total}</strong>
            </div>
            <p>
              Chọn trạng thái “Tất cả” để xem cả hồ sơ đã duyệt và đã từ chối. Từ chối bắt buộc nhập lý do để chủ sân chỉnh sửa và gửi lại.
            </p>
          </section>

          <section className="approval-toolbar">
            <div className="approval-filter-row">
              <label className="approval-status-filter approval-search-filter">
                Tìm theo tên hồ sơ
                <span className="approval-search-input">
                  <SearchIcon size={14} color="var(--text-secondary)" />
                  <input
                    type="search"
                    value={search}
                    placeholder="Nhập tên cơ sở hoặc sân"
                    onChange={event => setSearch(event.target.value)}
                  />
                </span>
              </label>
              <label className="approval-status-filter">
                Trạng thái yêu cầu
                <select
                  value={status}
                  onChange={event => { setStatus(event.target.value as FacilityReviewStatus | ''); setPage(1); }}
                >
                  <option value="">Tất cả</option>
                  <option value="PENDING">Chờ duyệt</option>
                  <option value="APPROVED">Đã duyệt</option>
                  <option value="REJECTED">Bị từ chối</option>
                </select>
              </label>
              <label className="approval-status-filter">
                Loại
                <select
                  value={filter}
                  onChange={event => { setFilter(event.target.value as ApprovalFilter); setPage(1); }}
                >
                  <option value="ALL">Tất cả</option>
                  <option value="FACILITY">Cơ sở &amp; đổi địa chỉ</option>
                  <option value="COURT">Sân</option>
                </select>
              </label>
            </div>
            <TimeRangeFilter
              value={range}
              onChange={value => { setRange(value); setPage(1); }}
              disabled={resource.loading}
              label="Thời gian gửi"
              className="approval-time-filter"
            />
          </section>

          <section className="approval-table-card">
            <div className="admin-table-container">
              <div className="admin-table-scroll">
                <table className="admin-table approval-table">
                  <thead>
                    <tr>
                      <th>Hồ sơ</th>
                      <th>Loại</th>
                      <th>Trạng thái</th>
                      <th>Gửi lúc</th>
                      <th>Xử lý</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.loading ? (
                      <tr>
                        <td colSpan={6} className="approval-table-state">Đang tải hồ sơ…</td>
                      </tr>
                    ) : resource.error ? (
                      <tr>
                        <td colSpan={6} className="approval-table-state approval-error" role="alert">
                          {resource.error}
                          <button type="button" onClick={resource.reload}>Thử lại</button>
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="approval-table-state">
                          Không có hồ sơ phù hợp. Thử đổi trạng thái, loại hồ sơ hoặc khoảng thời gian.
                        </td>
                      </tr>
                    ) : (
                      items.map(review => (
                        <ReviewRow key={review.id} review={review} onDecided={handleDecided} notify={notify} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
      </div>
    </div>
  );
}
