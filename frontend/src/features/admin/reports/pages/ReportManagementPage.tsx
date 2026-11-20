import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';
import { ToastContainer, type ToastMessage } from '../../components/Toast';
import { TablePagination } from '../../components/TablePagination';
import { DataTable, type ColumnDef } from '../../../../components/common/DataTable';
import { FilterToolbar } from '../../../../components/common/FilterToolbar';
import { TimeRangeFilter } from '../../../../components/common/TimeRangeFilter';
import { Dialog } from '../../../../components/common/Dialog';
import { ApiError } from '../../../../shared/api/http-client';
import { todayIsoDate, type TimeRangeValue } from '../../../../shared/time-range';
import { ADMIN_REPORTS_CHANGED_EVENT, adminReportService } from '../services/admin-report-service';
import { ReportTargetPanel } from '../components/ReportTargetPanel';
import {
  REASON_LABELS, TARGET_TYPE_LABELS, targetIdOf,
  type AdminReport, type AdminReportDetail, type ReportPageMeta,
  type ReportStatus, type ReportTargetType,
} from '../types/report';
import '../reports.css';
import '../../../../components/common/report-dialog.css';

const TARGET_FILTERS = (Object.keys(TARGET_TYPE_LABELS) as ReportTargetType[]).map(value => ({
  value, label: TARGET_TYPE_LABELS[value],
}));

function timeRangeDates(range: TimeRangeValue): { startDate?: string; endDate?: string } {
  if (range.preset === 'custom') {
    return range.startDate && range.endDate
      ? { startDate: range.startDate, endDate: range.endDate }
      : {};
  }
  const today = todayIsoDate();
  if (range.preset === 'day') return { startDate: today, endDate: today };
  if (range.preset === 'month') return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
  return { startDate: `${today.slice(0, 4)}-01-01`, endDate: today };
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

function reportTargetId(report: AdminReport): string {
  return targetIdOf(report) ?? '—';
}

export const ReportManagementPage: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [meta, setMeta] = useState<ReportPageMeta>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [targetType, setTargetType] = useState<ReportTargetType | ''>('');
  const [status, setStatus] = useState<ReportStatus | ''>('');
  const [range, setRange] = useState<TimeRangeValue>({ preset: 'month' });
  const { preset: rangePreset, startDate: rangeStartDate, endDate: rangeEndDate } = range;
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState('');
  const requestIdRef = useRef(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const detailRequestRef = useRef(0);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const addToast = (type: ToastMessage['type'], message: string) => {
    const id = String(++toastIdRef.current);
    setToasts(current => [...current, { id, type, message }]);
    window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 4000);
  };

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setListError('');
    try {
      const dates = timeRangeDates({ preset: rangePreset, startDate: rangeStartDate, endDate: rangeEndDate });
      const response = await adminReportService.list({
        page,
        limit,
        ...(targetType ? { targetType } : {}),
        ...(status ? { status } : {}),
        ...(dates.startDate ? { startDate: dates.startDate, endDate: dates.endDate } : {}),
      });
      if (requestId !== requestIdRef.current) return;
      setReports(response.data);
      setMeta(response.meta);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setReports([]);
      setListError(error instanceof ApiError ? error.message : 'Không thể tải danh sách báo cáo.');
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [page, limit, targetType, status, rangePreset, rangeStartDate, rangeEndDate]);

  useEffect(() => { void load(); }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    const requestId = ++detailRequestRef.current;
    setDetailLoading(true);
    setDetailError('');
    try {
      const next = await adminReportService.get(id);
      if (requestId !== detailRequestRef.current) return;
      setDetail(next);
    } catch (error) {
      if (requestId !== detailRequestRef.current) return;
      setDetail(null);
      setDetailError(error instanceof ApiError ? error.message : 'Không thể tải chi tiết báo cáo.');
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }, []);

  const [searchParams] = useSearchParams();
  const reportIdParam = searchParams.get('reportId');
  const openedFromQuery = useRef<string | null>(null);

  useEffect(() => {
    if (!reportIdParam || !/^\d+$/.test(reportIdParam) || openedFromQuery.current === reportIdParam) return;
    openedFromQuery.current = reportIdParam;
    setSelectedId(reportIdParam);
    setDetail(null);
    setDetailError('');
    setActionError('');
    void loadDetail(reportIdParam);
  }, [reportIdParam, loadDetail]);

  const openDetail = (report: AdminReport) => {
    setSelectedId(report.id);
    setDetail(null);
    setDetailError('');
    setActionError('');
    void loadDetail(report.id);
  };

  const closeDetail = () => {
    if (actionBusy) return;
    detailRequestRef.current += 1;
    setSelectedId(null);
    setDetail(null);
    setDetailLoading(false);
    setDetailError('');
    setActionError('');
  };

  const refreshAfterAction = async (message: string) => {
    addToast('success', message);
    void load();
    window.dispatchEvent(new Event(ADMIN_REPORTS_CHANGED_EVENT));
    if (selectedId) await loadDetail(selectedId);
  };

  const resolve = async () => {
    if (!detail || detail.status !== 'OPEN') return;
    setActionBusy(true);
    setActionError('');
    try {
      await adminReportService.resolve(detail.id);
      await refreshAfterAction(`Đã đánh dấu báo cáo #${detail.id} là đã xử lý.`);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Không thể cập nhật trạng thái báo cáo.');
    } finally {
      setActionBusy(false);
    }
  };

  const hideTarget = async () => {
    if (!detail) return;
    const targetId = reportTargetId(detail);
    if (targetId === '—') return;
    setActionBusy(true);
    setActionError('');
    try {
      if (detail.targetType === 'POST') await adminReportService.hidePost(targetId);
      else if (detail.targetType === 'COMMENT') await adminReportService.hideComment(targetId);
      else return;
      await refreshAfterAction(
        detail.targetType === 'POST'
          ? `Đã ẩn bài viết #${targetId}.`
          : `Đã ẩn bình luận #${targetId}.`,
      );
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Không thể ẩn nội dung bị báo cáo.');
    } finally {
      setActionBusy(false);
    }
  };

  const columns: ColumnDef<AdminReport>[] = [
    {
      key: 'id', header: 'Mã', width: 72,
      render: report => <strong>#{report.id}</strong>,
    },
    {
      key: 'target', header: 'Đối tượng',
      render: report => (
        <div>
          <strong>{TARGET_TYPE_LABELS[report.targetType]}</strong>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ID: {reportTargetId(report)}</div>
        </div>
      ),
    },
    {
      key: 'reason', header: 'Lý do',
      render: report => REASON_LABELS[report.reasonCode] ?? report.reasonCode,
    },
    {
      key: 'status', header: 'Trạng thái', width: 130,
      render: report => (
        <span className={`report-admin-pill ${report.status === 'OPEN' ? 'open' : 'resolved'}`}>
          {report.status === 'OPEN' ? 'Chờ xử lý' : 'Đã xử lý'}
        </span>
      ),
    },
    {
      key: 'createdAt', header: 'Gửi lúc', width: 180,
      render: report => formatDate(report.createdAt),
    },
    {
      key: 'action', header: '', width: 130,
      render: report => (
        <button
          type="button"
          className="social-button"
          onClick={event => { event.stopPropagation(); openDetail(report); }}
        >
          Xem &amp; xử lý
        </button>
      ),
    },
  ];

  return (
    <div className="admin-layout">
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(value => !value)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <div className={`admin-main-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <AdminHeader
          isCollapsed={isCollapsed}
          onToggleMobileSidebar={() => setIsMobileOpen(true)}
        />

        <main style={{
          padding: '96px 20px 48px', display: 'flex', flexDirection: 'column', gap: 24,
          maxWidth: 1400, width: '100%', margin: '0 auto', boxSizing: 'border-box',
        }}>
          <div className="page-top-header">
            <div className="page-top-header-info">
              <h1 className="page-top-header-title">Quản lý báo cáo &amp; kiểm duyệt</h1>
              <p className="page-top-header-desc">
                Tiếp nhận báo cáo từ người chơi, xem bằng chứng tại thời điểm gửi và ẩn nội dung vi phạm.
              </p>
            </div>
            <button
              type="button"
              className="social-button"
              disabled={isLoading}
              onClick={() => void load()}
            >
              Làm mới
            </button>
          </div>

          <FilterToolbar
            filters={[
              {
                id: 'targetType', value: targetType, placeholder: 'Loại đối tượng',
                options: TARGET_FILTERS,
                onChange: value => { setTargetType(value as ReportTargetType | ''); setPage(1); },
                ariaLabel: 'Lọc theo loại đối tượng',
              },
              {
                id: 'status', value: status, placeholder: 'Trạng thái',
                options: [
                  { value: 'OPEN', label: 'Chờ xử lý' },
                  { value: 'RESOLVED', label: 'Đã xử lý' },
                ],
                onChange: value => { setStatus(value as ReportStatus | ''); setPage(1); },
                ariaLabel: 'Lọc theo trạng thái',
              },
            ]}
            extra={(
              <TimeRangeFilter
                className="report-time-range"
                value={range}
                onChange={next => { setRange(next); setPage(1); }}
                disabled={isLoading}
              />
            )}
            activeChips={[
              ...(targetType ? [{
                id: 'targetType',
                label: `Đối tượng: ${TARGET_TYPE_LABELS[targetType]}`,
                onRemove: () => { setTargetType(''); setPage(1); },
              }] : []),
              ...(status ? [{
                id: 'status',
                label: `Trạng thái: ${status === 'OPEN' ? 'Chờ xử lý' : 'Đã xử lý'}`,
                onRemove: () => { setStatus(''); setPage(1); },
              }] : []),
            ]}
            totalCount={meta.total}
            totalCountLabel="báo cáo"
            onClearAll={() => { setTargetType(''); setStatus(''); setPage(1); }}
          />

          {listError && (
            <div className="report-admin-error" role="alert">
              {listError}{' '}
              <button type="button" className="social-button" onClick={() => void load()}>Thử lại</button>
            </div>
          )}

          <div className="report-admin-table">
            <DataTable
              data={reports}
              columns={columns}
              keyExtractor={report => report.id}
              isLoading={isLoading}
              onRowClick={openDetail}
              emptyState={(
                <div className="report-admin-empty">
                  <strong>Chưa có báo cáo phù hợp</strong>
                  <p>Thử xóa bộ lọc hoặc chờ người chơi gửi báo cáo mới.</p>
                </div>
              )}
            />
          </div>

          <TablePagination
            page={page}
            limit={limit}
            total={meta.total}
            totalPages={meta.totalPages}
            totalLabel="báo cáo"
            onPageChange={setPage}
            onLimitChange={value => { setLimit(value); setPage(1); }}
          />
        </main>
      </div>

      {selectedId && (
        <Dialog
          title={`Báo cáo #${selectedId}`}
          wide
          busy={actionBusy}
          onClose={closeDetail}
        >
          {detailLoading && <p role="status">Đang tải chi tiết báo cáo…</p>}
          {detailError && (
            <div className="report-admin-error" role="alert">
              {detailError}{' '}
              <button type="button" className="social-button" onClick={() => void loadDetail(selectedId)}>
                Thử lại
              </button>
            </div>
          )}

          {detail && (
            <div className="report-admin-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ReportTargetPanel target={detail.target} />

                <div className="report-admin-card">
                  <div className="report-admin-pills">
                    <span className="report-admin-pill">{TARGET_TYPE_LABELS[detail.targetType]}</span>
                    <span className={`report-admin-pill ${detail.status === 'OPEN' ? 'open' : 'resolved'}`}>
                      {detail.status === 'OPEN' ? 'Chờ xử lý' : 'Đã xử lý'}
                    </span>
                    <span className="report-admin-pill">{REASON_LABELS[detail.reasonCode] ?? detail.reasonCode}</span>
                  </div>

                  <h3>Mô tả từ người báo cáo</h3>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{detail.description || 'Không có mô tả.'}</p>

                  <h3>Bằng chứng tại thời điểm gửi</h3>
                  {detail.evidence.text ? (
                    <p className="report-admin-evidence-text">{detail.evidence.text}</p>
                  ) : (
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Không có nội dung văn bản.</p>
                  )}

                  {detail.evidence.media.length > 0 ? (
                    <div className="report-admin-media-grid">
                      {detail.evidence.media.map(media => (
                        media.kind === 'IMAGE' ? (
                          <a
                            key={media.mediaId}
                            className="report-admin-media"
                            href={media.url}
                            target="_blank"
                            rel="noreferrer"
                            title={`Mở ảnh bằng chứng ${media.mediaId} trong tab mới`}
                          >
                            <img src={media.url} alt={`Bằng chứng ${media.mediaId}`} />
                          </a>
                        ) : (
                          <a
                            key={media.mediaId}
                            className="report-admin-media report-admin-media-file"
                            href={media.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span aria-hidden="true">📎</span>
                            <span>{media.originalName ?? `Tệp ${media.mediaId}`}</span>
                          </a>
                        )
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Không có tệp bằng chứng.</p>
                  )}
                </div>
              </div>

              <aside className="report-admin-card">
                <h3>Thông tin báo cáo</h3>
                <dl className="report-admin-meta">
                  <dt>Người báo cáo</dt>
                  <dd><Link to={`/admin/users?userId=${detail.reporterId}`}>#{detail.reporterId}</Link></dd>
                  <dt>Đối tượng</dt><dd>{TARGET_TYPE_LABELS[detail.targetType]} #{reportTargetId(detail)}</dd>
                  {detail.reportedAttachmentId && <><dt>Tệp đính kèm</dt><dd>#{detail.reportedAttachmentId}</dd></>}
                  <dt>Gửi lúc</dt><dd>{formatDate(detail.createdAt)}</dd>
                  <dt>Cập nhật</dt><dd>{formatDate(detail.updatedAt)}</dd>
                  <dt>Xử lý lúc</dt><dd>{formatDate(detail.resolvedAt)}</dd>
                </dl>

                {actionError && <p className="report-admin-error" role="alert">{actionError}</p>}

                <div className="report-admin-actions">
                  {detail.status === 'OPEN' && (
                    <button type="button" className="primary" disabled={actionBusy} onClick={() => void resolve()}>
                      {actionBusy ? 'Đang xử lý…' : 'Đánh dấu đã xử lý'}
                    </button>
                  )}
                  {detail.targetType === 'POST' && (
                    <button type="button" className="danger" disabled={actionBusy} onClick={() => void hideTarget()}>
                      Ẩn bài viết
                    </button>
                  )}
                  {detail.targetType === 'COMMENT' && (
                    <button type="button" className="danger" disabled={actionBusy} onClick={() => void hideTarget()}>
                      Ẩn bình luận
                    </button>
                  )}
                  {detail.targetType === 'MESSAGE' && (
                    <p className="report-dialog-note" style={{ margin: 0 }}>
                      Tin nhắn không có thao tác ẩn trong MVP; Admin chỉ xem bằng chứng của đúng tin nhắn được báo cáo.
                    </p>
                  )}
                </div>
              </aside>
            </div>
          )}
        </Dialog>
      )}

      <ToastContainer toasts={toasts} onRemove={id => setToasts(current => current.filter(toast => toast.id !== id))} />
    </div>
  );
};
