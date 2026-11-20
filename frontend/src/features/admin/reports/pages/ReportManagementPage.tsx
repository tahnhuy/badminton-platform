import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CircleAlert, EyeOff, FileText, Inbox, Info, Paperclip, RefreshCw } from 'lucide-react';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';
import { AdminMain } from '../../components/AdminMain';
import { ToastContainer, type ToastMessage } from '../../components/Toast';
import { TablePagination } from '../../components/TablePagination';
import { DataTable, type ColumnDef } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { FilterToolbar } from '@/components/common/filter-toolbar';
import { ContentPanel, DetailRow } from '@/components/common/content-panel';
import { PageHeader } from '@/components/common/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TimeRangeFilter } from '../../../../components/common/TimeRangeFilter';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ApiError } from '../../../../shared/api/http-client';
import { todayIsoDate, type TimeRangeValue } from '../../../../shared/time-range';
import { ADMIN_REPORTS_CHANGED_EVENT, adminReportService } from '../services/admin-report-service';
import { ReportTargetPanel } from '../components/ReportTargetPanel';
import {
  REASON_LABELS, TARGET_TYPE_LABELS, targetIdOf,
  type AdminReport, type AdminReportDetail, type ReportPageMeta,
  type ReportStatus, type ReportTargetType,
} from '../types/report';

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

const STATUS_BADGE: Record<ReportStatus, string> = {
  OPEN: 'bg-caution-bg text-caution',
  RESOLVED: 'bg-success-bg text-success',
};

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
      key: 'id', header: 'MÃ', width: 90,
      render: report => <strong>#{report.id}</strong>,
    },
    {
      key: 'target', header: 'ĐỐI TƯỢNG', minWidth: 160,
      render: report => <div>
        <p className="font-semibold">{TARGET_TYPE_LABELS[report.targetType]}</p>
        <p className="text-xs text-muted-foreground">ID: {reportTargetId(report)}</p>
      </div>,
    },
    {
      key: 'reason', header: 'LÝ DO', minWidth: 160,
      render: report => REASON_LABELS[report.reasonCode] ?? report.reasonCode,
    },
    {
      key: 'status', header: 'TRẠNG THÁI', width: 140,
      render: report => <Badge className={STATUS_BADGE[report.status]}>
        {report.status === 'OPEN' ? 'Chờ xử lý' : 'Đã xử lý'}
      </Badge>,
    },
    {
      key: 'createdAt', header: 'GỬI LÚC', width: 180,
      render: report => <span className="text-muted-foreground">{formatDate(report.createdAt)}</span>,
    },
    {
      key: 'action', header: '', width: 160,
      render: report => <Button type="button" variant="outline" className="h-9 px-3"
        onClick={event => { event.stopPropagation(); openDetail(report); }}>
        Xem &amp; xử lý
      </Button>,
    },
  ];

  return (
    <div className="flex min-h-svh bg-background font-sans text-foreground">
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(value => !value)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <AdminMain isCollapsed={isCollapsed}>
        <AdminHeader
          isCollapsed={isCollapsed}
          onToggleMobileSidebar={() => setIsMobileOpen(true)}
        />

        <main id="admin-main-content" tabIndex={-1}
          className="mx-auto flex w-full min-w-0 max-w-360 flex-col gap-6 px-4 pb-16 pt-24 sm:px-6">
          <PageHeader
            title="Quản lý báo cáo & kiểm duyệt"
            description="Tiếp nhận báo cáo từ người chơi, xem bằng chứng tại thời điểm gửi và ẩn nội dung vi phạm."
            actions={<Button type="button" variant="outline" disabled={isLoading} onClick={() => void load()}>
              <RefreshCw aria-hidden="true" />
              Làm mới
            </Button>}
          />

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
            rightActions={(
              <div className="col-span-full min-w-0 xl:w-full xl:basis-full">
                <TimeRangeFilter
                  layout="inline"
                  value={range}
                  onChange={next => { setRange(next); setPage(1); }}
                  disabled={isLoading}
                />
              </div>
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

          {isLoading && <p role="status" className="sr-only">Đang tải danh sách báo cáo…</p>}

          {listError ? (
            <EmptyState role="alert" icon={CircleAlert} title="Không tải được danh sách báo cáo"
              description={listError} action={{ label: 'Thử lại', onClick: () => void load() }} />
          ) : (
            <DataTable
              data={reports}
              columns={columns}
              keyExtractor={report => report.id}
              isLoading={isLoading}
              onRowClick={openDetail}
              emptyState={(
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Inbox aria-hidden="true" className="size-6" />
                  <p className="text-sm font-semibold text-foreground">Chưa có báo cáo phù hợp</p>
                  <p className="text-sm">Thử xóa bộ lọc hoặc chờ người chơi gửi báo cáo mới.</p>
                </div>
              )}
            />
          )}

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
      </AdminMain>

      {selectedId && (
        <Dialog open onOpenChange={open => { if (!open && !actionBusy) closeDetail(); }}>
          <DialogContent variant="side" className="max-w-4xl" closeDisabled={actionBusy} aria-describedby={undefined}>
            <DialogTitle className="mb-4">Báo cáo #{selectedId}</DialogTitle>
            {detailLoading && <p role="status" className="text-sm text-muted-foreground">Đang tải chi tiết báo cáo…</p>}
            {detailError && (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-bg p-3 text-sm text-danger">
                <span>{detailError}</span>
                <Button type="button" variant="danger-soft" className="h-9 px-3" onClick={() => void loadDetail(selectedId)}>
                  Thử lại
                </Button>
              </div>
            )}

            {detail && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap gap-2">
                  <Badge>{TARGET_TYPE_LABELS[detail.targetType]}</Badge>
                  <Badge className={STATUS_BADGE[detail.status]}>
                    {detail.status === 'OPEN' ? 'Chờ xử lý' : 'Đã xử lý'}
                  </Badge>
                  <Badge>{REASON_LABELS[detail.reasonCode] ?? detail.reasonCode}</Badge>
                </div>

                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                  <div className="flex min-w-0 flex-col gap-4">
                    <ReportTargetPanel target={detail.target} />

                    <ContentPanel title="Nội dung báo cáo" icon={FileText}>
                      <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-bold">Mô tả từ người báo cáo</h3>
                        <p className="whitespace-pre-wrap text-sm leading-6">{detail.description || 'Không có mô tả.'}</p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-bold">Bằng chứng tại thời điểm gửi</h3>
                        {detail.evidence.text ? (
                          <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm leading-6 [overflow-wrap:anywhere]">
                            {detail.evidence.text}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Không có nội dung văn bản.</p>
                        )}
                      </div>

                      {detail.evidence.media.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {detail.evidence.media.map(media => (
                            media.kind === 'IMAGE' ? (
                              <a
                                key={media.mediaId}
                                className="overflow-hidden rounded-lg border border-border bg-card outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
                                href={media.url}
                                target="_blank"
                                rel="noreferrer"
                                title={`Mở ảnh bằng chứng ${media.mediaId} trong tab mới`}
                              >
                                <img className="h-28 w-full bg-muted object-cover" src={media.url} alt={`Bằng chứng ${media.mediaId}`} />
                              </a>
                            ) : (
                              <a
                                key={media.mediaId}
                                className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm font-semibold outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                                href={media.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Paperclip aria-hidden="true" className="size-4 shrink-0" />
                                <span className="min-w-0 break-words">{media.originalName ?? `Tệp ${media.mediaId}`}</span>
                              </a>
                            )
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Không có tệp bằng chứng.</p>
                      )}
                    </ContentPanel>
                  </div>

                  <aside className="flex min-w-0 flex-col gap-4">
                    <ContentPanel title="Thông tin báo cáo" icon={Info}>
                      <div>
                        <DetailRow label="Người báo cáo" value={
                          <Link className="text-primary underline-offset-2 hover:underline" to={`/admin/users?userId=${detail.reporterId}`}>
                            #{detail.reporterId}
                          </Link>
                        } />
                        <DetailRow label="Đối tượng" value={`${TARGET_TYPE_LABELS[detail.targetType]} #${reportTargetId(detail)}`} />
                        {detail.reportedAttachmentId && <DetailRow label="Tệp đính kèm" value={`#${detail.reportedAttachmentId}`} />}
                        <DetailRow label="Gửi lúc" value={formatDate(detail.createdAt)} />
                        <DetailRow label="Cập nhật" value={formatDate(detail.updatedAt)} />
                        <DetailRow label="Xử lý lúc" value={formatDate(detail.resolvedAt)} />
                      </div>

                      {actionError && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-sm text-danger">{actionError}</p>}

                      <div className="flex flex-col gap-2">
                        {detail.status === 'OPEN' && (
                          <Button type="button" variant="brand" disabled={actionBusy} onClick={() => void resolve()}>
                            <CheckCircle2 aria-hidden="true" />
                            {actionBusy ? 'Đang xử lý…' : 'Đánh dấu đã xử lý'}
                          </Button>
                        )}
                        {detail.targetType === 'POST' && (
                          <Button type="button" variant="danger-soft" disabled={actionBusy} onClick={() => void hideTarget()}>
                            <EyeOff aria-hidden="true" />
                            Ẩn bài viết
                          </Button>
                        )}
                        {detail.targetType === 'COMMENT' && (
                          <Button type="button" variant="danger-soft" disabled={actionBusy} onClick={() => void hideTarget()}>
                            <EyeOff aria-hidden="true" />
                            Ẩn bình luận
                          </Button>
                        )}
                        {detail.targetType === 'MESSAGE' && (
                          <p className="rounded-lg bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                            Tin nhắn không có thao tác ẩn trong MVP; Admin chỉ xem bằng chứng của đúng tin nhắn được báo cáo.
                          </p>
                        )}
                      </div>
                    </ContentPanel>
                  </aside>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      <ToastContainer toasts={toasts} onRemove={id => setToasts(current => current.filter(toast => toast.id !== id))} />
    </div>
  );
};
