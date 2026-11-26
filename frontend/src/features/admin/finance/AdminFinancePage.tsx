import { toast } from 'sonner';
import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { AdminHeader } from '../components/AdminHeader';
import { AdminSidebar } from '../components/AdminSidebar';
import { TablePagination } from '@/components/common/table-pagination';
import { AdminMain } from '../components/AdminMain';
import { PageHeader } from '@/components/common/page-layout';
import { EmptyState } from '@/components/common/empty-state';
import type { ColumnDef } from '@/components/common/data-table';
import { ContentPanel } from '@/components/common/content-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToastContainer, type ToastMessage } from '../components/Toast';
import { ApiError } from '../../../shared/api/http-client';
import { financeLabel, financeText, financeDate, discrepancyMessage } from './finance-labels';
import { FinancePeriodFilter } from './finance-period-filter';
import { WalletUserSearch } from './wallet-user-search';
import { FinanceTable } from './finance-table';
import { FinanceValue } from './finance-value';
import { FinanceAdvancedFilters, type FinanceListFilters } from './finance-list-filters';
import { ManualMatchDialog, WalletAdjustmentDialog, type ManualMatchPayload, type WalletAdjustmentPayload } from './finance-action-dialogs';
import { PromptDialog } from '../components/PromptDialog';
import { adminFinanceService } from './services/adminFinanceService';
import type { FinanceExportType } from './services/adminFinanceService';
import type {
  FinanceAudit,
  FinanceOwnerEarning,
  FinanceOwnerEarningSettlement,
  FinanceOverview,
  FinancePageMeta,
  FinancePayout,
  FinanceReconciliation,
  FinanceRefund,
  FinanceReport,
  FinanceTopUp,
  FinanceTransaction,
  FinanceWallet,
  FinanceWalletEntry,
} from './types';

const SECTIONS = [
  { key: 'overview', path: '/admin/finance/overview', label: 'Tổng quan' },
  { key: 'transactions', path: '/admin/finance/transactions', label: 'Giao dịch' },
  { key: 'wallets', path: '/admin/finance/wallets', label: 'Ví' },
  { key: 'top-ups', path: '/admin/finance/top-ups', label: 'Nạp tiền' },
  { key: 'payouts', path: '/admin/finance/payouts', label: 'Chi trả' },
  { key: 'refunds', path: '/admin/finance/refunds', label: 'Hoàn tiền' },
  { key: 'owner-earnings', path: '/admin/finance/owner-earnings', label: 'Thu nhập chủ sân' },
  { key: 'reconciliation', path: '/admin/finance/reconciliation', label: 'Đối soát' },
  { key: 'reports', path: '/admin/finance/reports', label: 'Báo cáo' },
  { key: 'audit', path: '/admin/finance/audit', label: 'Nhật ký thao tác' },
] as const;

type FinanceSection = (typeof SECTIONS)[number]['key'];
type WalletEntry = FinanceWalletEntry;

type FinancePrompt =
  | { kind: 'payout'; payout: FinancePayout; action: 'approve' | 'reject' | 'paid' }
  | { kind: 'refund'; refund: FinanceRefund }
  | { kind: 'settlement'; settlement: FinanceOwnerEarningSettlement; action: 'approve' | 'reject' }
  | { kind: 'reversal'; bookingId: number }
  | { kind: 'discrepancy'; key: string };

interface FinancePromptConfig {
  title: string;
  description: string;
  label: string;
  required?: boolean;
  requiredMessage?: string;
  confirmLabel: string;
  tone?: 'default' | 'brand' | 'danger';
  multiline?: boolean;
}

const EMPTY_FILTERS: FinanceListFilters = {};

function financePage<T>(data: T[], page: number, limit: number) {
  const totalPages = Math.ceil(data.length / limit);
  const currentPage = Math.max(1, Math.min(page, totalPages || 1));
  return { rows: data.slice((currentPage - 1) * limit, currentPage * limit),
    meta: { page: currentPage, limit, total: data.length, totalPages } };
}

const EMPTY_META: FinancePageMeta = { page: 1, limit: 20, total: 0, totalPages: 0 };

function money(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? `${amount.toLocaleString('vi-VN')}đ` : String(value ?? '—');
}

function dateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : error instanceof Error ? error.message : fallback;
}

function financePromptConfig(target: FinancePrompt): FinancePromptConfig {
  if (target.kind === 'reversal') return { title: 'Thu hồi thu nhập chủ sân', description: `Booking #${target.bookingId}. Chỉ thu hồi khi ví chủ sân đủ số dư.`, label: 'Lý do thu hồi', required: true, confirmLabel: 'Thử lại thu hồi', tone: 'danger' };
  if (target.kind === 'payout') {
    const description = `#${target.payout.id} · User #${target.payout.userId} · ${money(target.payout.amount)}`;
    if (target.action === 'approve') return { title: 'Duyệt yêu cầu chi trả', description, label: 'Ghi chú duyệt (không bắt buộc)', confirmLabel: 'Duyệt' };
    if (target.action === 'reject') return { title: 'Từ chối yêu cầu chi trả', description, label: 'Lý do từ chối', required: true, requiredMessage: 'Nhập lý do từ chối.', confirmLabel: 'Từ chối', tone: 'danger' };
    return { title: 'Đánh dấu đã chi', description, label: 'Mã giao dịch chuyển khoản', required: true, requiredMessage: 'Nhập mã giao dịch chuyển khoản.', confirmLabel: 'Đã chi' };
  }
  if (target.kind === 'refund') return {
    title: 'Ghi chú xử lý hoàn tiền',
    description: `Thanh toán #${target.refund.paymentId} · ${money(target.refund.amount)}`,
    label: 'Ghi chú xử lý', required: true, requiredMessage: 'Nhập ghi chú xử lý.', confirmLabel: 'Lưu ghi chú', multiline: true,
  };
  if (target.kind === 'settlement') {
    const description = `#${target.settlement.id} · Booking #${target.settlement.bookingId} · ${money(target.settlement.amount)}`;
    if (target.action === 'approve') return { title: 'Duyệt thu nhập chủ sân', description, label: 'Ghi chú duyệt (không bắt buộc)', confirmLabel: 'Duyệt & cộng ví', tone: 'brand' };
    return { title: 'Từ chối thu nhập chủ sân', description, label: 'Lý do từ chối', required: true, requiredMessage: 'Nhập lý do từ chối.', confirmLabel: 'Từ chối', tone: 'danger' };
  }
  return {
    title: 'Xử lý chênh lệch đối soát', description: target.key,
    label: 'Ghi chú xử lý lệch', required: true, requiredMessage: 'Nhập ghi chú xử lý lệch.', confirmLabel: 'Xác nhận xử lý', multiline: true,
  };
}

function statusTone(value: string): string {
  if (['FAILED', 'REJECTED', 'EXPIRED'].includes(value)) return 'bg-danger-bg text-danger';
  if (['PAID', 'SUCCESS', 'REFUNDED', 'POSTED', 'CREDITED'].includes(value)) return 'bg-success-bg text-success';
  return 'bg-caution-bg text-caution';
}

function StatusBadge({ value }: { value: string }) {
  return <Badge className={statusTone(value)}>{financeLabel(value)}</Badge>;
}

function KpiCard({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 shadow-sm">
    <p className="text-xs font-semibold text-muted-foreground">{label}</p>
    <p className="text-xl font-extrabold tracking-tight tabular-nums">{value}</p>
    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
  </div>;
}

function FilterControl({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground">
    <span>{label}</span>
    {children}
  </label>;
}

function TableEmpty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export const AdminFinancePage: React.FC = () => {
  const params = useParams<{ section?: string }>();
  const [searchParams] = useSearchParams();
  const section = (SECTIONS.some(item => item.key === params.section) ? params.section : 'overview') as FinanceSection;
  const activeSection = SECTIONS.find(item => item.key === section)!;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [customPeriod, setCustomPeriod] = useState<{ startDate?: string; endDate?: string }>({});
  const [discrepancyType, setDiscrepancyType] = useState('');
  const [range, setRange] = useState('30d');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [groupBy, setGroupBy] = useState('day');
  const [walletId, setWalletId] = useState('');
  const walletSelectionRef = useRef('');
  const [filterState, setFilterState] = useState<{ section: string; values: FinanceListFilters }>({ section, values: EMPTY_FILTERS });
  const extraFilters = filterState.section === section ? filterState.values : EMPTY_FILTERS;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const serverPaged = !['overview', 'reports', 'reconciliation'].includes(section);
  const requestPage = serverPaged ? page : 1;
  const requestLimit = serverPaged ? limit : 10;
  const loadRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [transactionMeta, setTransactionMeta] = useState<FinancePageMeta>(EMPTY_META);
  const [detail, setDetail] = useState<unknown>(null);
  const [wallet, setWallet] = useState<FinanceWallet | null>(null);
  const [walletEntries, setWalletEntries] = useState<WalletEntry[]>([]);
  const [walletMeta, setWalletMeta] = useState<FinancePageMeta>(EMPTY_META);
  const [topUps, setTopUps] = useState<FinanceTopUp[]>([]);
  const [topUpMeta, setTopUpMeta] = useState<FinancePageMeta>(EMPTY_META);
  const [payouts, setPayouts] = useState<FinancePayout[]>([]);
  const [payoutMeta, setPayoutMeta] = useState<FinancePageMeta>(EMPTY_META);
  const [refunds, setRefunds] = useState<FinanceRefund[]>([]);
  const [refundMeta, setRefundMeta] = useState<FinancePageMeta>(EMPTY_META);
  const [ownerEarnings, setOwnerEarnings] = useState<FinanceOwnerEarning[]>([]);
  const [ownerEarningMeta, setOwnerEarningMeta] = useState<FinancePageMeta>(EMPTY_META);
  const [ownerSettlements, setOwnerSettlements] = useState<FinanceOwnerEarningSettlement[]>([]);
  const [ownerSettlementMeta, setOwnerSettlementMeta] = useState<FinancePageMeta>(EMPTY_META);
  const [ownerEarningView, setOwnerEarningView] = useState<'PENDING' | 'LEDGER'>('PENDING');
  const [reconciliation, setReconciliation] = useState<FinanceReconciliation | null>(null);
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [audits, setAudits] = useState<FinanceAudit[]>([]);
  const [auditMeta, setAuditMeta] = useState<FinancePageMeta>(EMPTY_META);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const [walletDialogKind, setWalletDialogKind] = useState<'credit' | 'debit' | null>(null);
  const [manualMatchOpen, setManualMatchOpen] = useState(false);
  const [matchTopUp, setMatchTopUp] = useState<FinanceTopUp | null>(null);
  const [prompt, setPrompt] = useState<FinancePrompt | null>(null);

  const payoutIdParam = Number(searchParams.get('payoutId'));
  const paymentIdParam = Number(searchParams.get('paymentId'));
  const settlementIdParam = Number(searchParams.get('settlementId'));

  const notify = useCallback((message: string) => {
    const id = `${Date.now()}-${toastIdRef.current++}`;
    setToasts(current => [...current, { id, type: 'success', message }]);
    window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 4000);
  }, []);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const isCurrent = () => requestId === loadRequestRef.current;
    async function loadOverview() {
      const response = await adminFinanceService.overview({ range, ...customPeriod });
      if (!isCurrent()) return;
      setOverview(response);

    }

    async function loadTransactions() {
      const response = await adminFinanceService.transactions({
        ...extraFilters,
        source: sourceFilter || undefined,
        status: statusFilter || undefined,
        page: requestPage,
        limit: requestLimit,
      });
      if (!isCurrent()) return;
      setTransactions(response.data);
      setTransactionMeta(response.meta);

    }

    async function loadWallets() {
      if (!walletId) {
        setWallet(null);
        setWalletEntries([]);
        setWalletMeta(EMPTY_META);
      } else {
        const id = Number(walletId);
        const [snapshot, entries] = await Promise.all([
          adminFinanceService.wallet(id),
          adminFinanceService.walletEntries(id, { page: requestPage, limit: requestLimit }),
        ]);
        if (!isCurrent() || walletSelectionRef.current !== walletId) return;
        setWallet(snapshot);
        setWalletEntries(entries.data);
        setWalletMeta(entries.meta);
      }

    }

    async function loadTopUps() {
      const response = await adminFinanceService.topUps({ ...extraFilters, status: statusFilter || undefined, page: requestPage, limit: requestLimit });
      if (!isCurrent()) return;
      setTopUps(response.data);
      setTopUpMeta(response.meta);

    }

    async function loadPayouts() {
      const response = await adminFinanceService.payouts({ ...extraFilters, status: statusFilter || undefined, page: requestPage, limit: requestLimit });
      if (!isCurrent()) return;
      setPayouts(response.data);
      setPayoutMeta(response.meta);

    }

    async function loadRefunds() {
      const response = await adminFinanceService.refunds({ ...extraFilters, status: statusFilter || undefined, page: requestPage, limit: requestLimit });
      if (!isCurrent()) return;
      setRefunds(response.data);
      setRefundMeta(response.meta);

    }

    async function loadOwnerEarnings() {
      const [history, settlements] = await Promise.all([
        adminFinanceService.ownerEarnings({ ...extraFilters, page: requestPage, limit: requestLimit }),
        adminFinanceService.ownerEarningSettlements({ ...extraFilters, status: 'PENDING', page: requestPage, limit: requestLimit }),
      ]);
      if (!isCurrent()) return;
      setOwnerEarnings(history.data);
      setOwnerEarningMeta(history.meta);
      setOwnerSettlements(settlements.data);
      setOwnerSettlementMeta(settlements.meta);

    }

    async function loadReconciliation() {
      const response = await adminFinanceService.reconciliation({ range, ...customPeriod });
      if (!isCurrent()) return;
      setReconciliation(response);

    }

    async function loadReports() {
      const response = await adminFinanceService.revenue({ range, groupBy, ...customPeriod });
      if (!isCurrent()) return;
      setReport(response);

    }

    async function loadAudit() {
      const response = await adminFinanceService.audit({ ...extraFilters, page: requestPage, limit: requestLimit, action: statusFilter || undefined });
      if (!isCurrent()) return;
      setAudits(response.data);
      setAuditMeta(response.meta);

    }

    setLoading(true);
    setError('');
    try {
      if (section === 'overview') {
        await loadOverview();
      } else if (section === 'transactions') {
        await loadTransactions();
      } else if (section === 'wallets') {
        await loadWallets();
      } else if (section === 'top-ups') {
        await loadTopUps();
      } else if (section === 'payouts') {
        await loadPayouts();
      } else if (section === 'refunds') {
        await loadRefunds();
      } else if (section === 'owner-earnings') {
        await loadOwnerEarnings();
      } else if (section === 'reconciliation') {
        await loadReconciliation();
      } else if (section === 'reports') {
        await loadReports();
      } else if (section === 'audit') {
        await loadAudit();
      }
    } catch (err) {
      if (!isCurrent() || (section === 'wallets' && walletSelectionRef.current !== walletId)) return;
      setError(errorMessage(err, 'Không thể tải dữ liệu tài chính.'));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [section, range, statusFilter, sourceFilter, groupBy, requestPage, requestLimit, walletId, extraFilters, customPeriod]);

  const reloadCurrentRef = useRef(load);
  const invalidateRequests = useCallback(() => {
    loadRequestRef.current++; detailRequestRef.current++;
    reloadCurrentRef.current = () => Promise.resolve();
  }, []);
  useEffect(() => {
    reloadCurrentRef.current = load;
    void load();
    setDetail(null); setDetailError(''); setDetailLoading(false);
    return invalidateRequests;
  }, [load, invalidateRequests]);
  useEffect(() => { setPage(1); setDetail(null); setStatusFilter(''); setSourceFilter(''); setToasts([]); }, [section]);
  useEffect(() => {
    if (section === 'owner-earnings' && settlementIdParam) setOwnerEarningView('PENDING');
  }, [section, settlementIdParam]);

  const closeDetail = () => {
    detailRequestRef.current++; setDetail(null); setDetailError(''); setDetailLoading(false);
  };
  const openTransactionDetail = async (transaction: FinanceTransaction) => {
    const requestId = ++detailRequestRef.current;
    setDetail(null); setDetailError(''); setDetailLoading(true);
    try {
      const response = await adminFinanceService.transactionDetail(transaction.source, transaction.sourceId);
      if (requestId === detailRequestRef.current) setDetail(response);
    } catch (err) {
      if (requestId === detailRequestRef.current) setDetailError(errorMessage(err, 'Không thể tải chi tiết giao dịch.'));
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  };

  const submitWalletAdjustment = async (kind: 'credit' | 'debit', payload: WalletAdjustmentPayload) => {
    const id = Number(walletId);
    if (!id) throw new Error('Chọn người dùng trước.');
    if (kind === 'credit') await adminFinanceService.creditWallet(id, payload);
    else await adminFinanceService.debitWallet(id, payload);
    notify(kind === 'credit' ? 'Đã cộng ví.' : 'Đã trừ ví.');
    await reloadCurrentRef.current();
  };

  const submitManualMatch = async (payload: ManualMatchPayload) => {
    await adminFinanceService.manualMatchTopUp(payload);
    notify('Đã ghép giao dịch nạp tiền.');
    await reloadCurrentRef.current();
  };

  const submitPrompt = async (target: FinancePrompt, value: string) => {
    if (target.kind === 'reversal') {
      await adminFinanceService.reverseOwnerEarning(target.bookingId, value);
      notify('Đã thu hồi thu nhập chủ sân.');
    } else if (target.kind === 'payout') {
      if (target.action === 'approve') await adminFinanceService.approvePayout(target.payout.id, value || undefined);
      else if (target.action === 'reject') await adminFinanceService.rejectPayout(target.payout.id, value);
      else await adminFinanceService.markPayoutPaid(target.payout.id, value);
      notify(`Đã cập nhật yêu cầu chi trả #${target.payout.id}.`);
    } else if (target.kind === 'refund') {
      await adminFinanceService.resolveRefund(target.refund.paymentId, value);
      notify('Đã ghi chú xử lý hoàn tiền.');
    } else if (target.kind === 'settlement') {
      if (target.action === 'approve') {
        await adminFinanceService.approveOwnerEarningSettlement(target.settlement.id, value || undefined);
        notify(`Đã duyệt và cộng ví chủ sân cho quyết toán #${target.settlement.id}.`);
      } else {
        await adminFinanceService.rejectOwnerEarningSettlement(target.settlement.id, value);
        notify(`Đã từ chối quyết toán #${target.settlement.id}.`);
      }
    } else {
      await adminFinanceService.resolveReconciliation(target.key, value);
      notify('Đã ghi nhận xử lý lệch.');
    }
    await reloadCurrentRef.current();
  };

  const retryRefund = async (refund: FinanceRefund) => {
    try {
      await adminFinanceService.retryRefund(refund.paymentId);
      notify(`Đã thử lại hoàn tiền #${refund.paymentId}.`);
      await reloadCurrentRef.current();
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể thử lại hoàn tiền.'));
    }
  };

  const runOwnerSweep = async (dryRun: boolean) => {
    try {
      const today = new Date();
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      const formatDate = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(value);
      const from = formatDate(start);
      const to = formatDate(today);
      const response = await adminFinanceService.sweepOwnerEarnings({ dryRun, limit: 200, from, to });
      const result = response.data;
      notify(`Thu nhập chủ sân: đã kiểm tra ${result.scanned}, đã cộng ví ${result.credited}, chờ duyệt ${result.pending}, bỏ qua ${result.skipped}, thất bại ${result.failed}.`);
      await reloadCurrentRef.current();
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể rà soát thu nhập chủ sân.'));
    }
  };

  const exportData = async (type: FinanceExportType) => {
    try {
      await adminFinanceService.downloadExport(type, {
        ...extraFilters,
        ...customPeriod,
        range,
        groupBy: type === 'revenue' ? groupBy : undefined,
        source: type === 'transactions' ? sourceFilter || undefined : undefined,
        status: ['transactions', 'top-ups', 'payouts', 'refunds'].includes(type) ? statusFilter || undefined : undefined,
      });
      notify('Đã xuất Excel.');
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể xuất Excel.'));
    }
  };

  const pager = (meta: FinancePageMeta, totalLabel = 'giao dịch') => <TablePagination
    page={meta.page} limit={limit} total={meta.total} totalPages={meta.totalPages} totalLabel={totalLabel}
    onPageChange={setPage} onLimitChange={value => { setLimit(value); setPage(1); }} />;

  const walletTools = <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
    <WalletTools
  walletId={walletId}
  load={load}
  walletSelectionRef={walletSelectionRef}
  setWalletId={setWalletId}
  setPage={setPage}
  setWallet={setWallet}
  setWalletEntries={setWalletEntries}
  setError={setError}
  wallet={wallet}
  loading={loading}
  setWalletDialogKind={setWalletDialogKind}
/>
  </div>;

  const filterBar = (
    <FinanceFilters
  section={section}
  range={range}
  setRange={setRange}
  setCustomPeriod={setCustomPeriod}
  setPage={setPage}
  statusFilter={statusFilter}
  setStatusFilter={setStatusFilter}
  sourceFilter={sourceFilter}
  setSourceFilter={setSourceFilter}
  groupBy={groupBy}
  setGroupBy={setGroupBy}
  loading={loading}
  load={load}
  customPeriod={customPeriod}
  extraFilters={extraFilters}
  setFilterState={setFilterState}
/>
  );


  function renderLoading(): ReactNode {
    return <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">Đang tải dữ liệu…</span>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>;

  }

  function renderError(): ReactNode {
    return <EmptyState role="alert" icon={CircleAlert} title="Không tải được dữ liệu tài chính" description={error} />;

  }

  function renderOverview(): ReactNode {
    const trend = financePage((overview?.trend.cashIn ?? []).map(row => ({
      day: row.day, cashIn: row.amount,
      cashOut: overview?.trend.cashOut.find(item => item.day === row.day)?.amount,
      revenue: overview?.trend.revenue.find(item => item.day === row.day)?.amount,
    })), page, limit);
    return overview ? (
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <KpiCard label="Tổng số dư ví" value={money(overview.walletLiability)} />
          <KpiCard label="Đang tạm giữ" value={money(overview.held)} />
          <KpiCard label="Khả dụng" value={money(overview.available)} />
          <KpiCard label="Tiền vào" value={money(overview.cashIn)} />
          <KpiCard label="Tiền ra" value={money(overview.cashOut)} />
          <KpiCard label="Tổng doanh thu" value={money(overview.grossRevenue)} />
          <KpiCard label="Hoàn tiền" value={money(overview.refunds)} />
          <KpiCard label="Doanh thu ròng ước tính" value={money(overview.netEstimated)} />
          <KpiCard label="Thu nhập chủ sân" value={money(overview.ownerEarnings)} />
          <KpiCard label="Chi trả chờ duyệt" value={overview.pendingPayouts.count} sub={money(overview.pendingPayouts.amount)} />
          <KpiCard label="Thu nhập chủ sân chờ duyệt" value={overview.pendingOwnerEarnings?.count ?? 0} sub={money(overview.pendingOwnerEarnings?.amount)} />
          <KpiCard label="Hoàn tiền thất bại" value={overview.failedRefunds.count} sub={money(overview.failedRefunds.amount)} />
        </div>

        {overview.tournament && <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold tracking-tight">Lệ phí giải đấu</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <KpiCard label="Lệ phí thu (gộp)" value={money(overview.tournament.grossFees)} />
            <KpiCard label="Lệ phí đã hoàn" value={money(overview.tournament.refunds)} />
            <KpiCard label="Lệ phí ròng" value={money(overview.tournament.netFees)} />
            <KpiCard label="Đã trả Organizer" value={money(overview.tournament.organizerEarnings)} sub="TOURNAMENT_EARNING trong kỳ" />
            <KpiCard label="Đang giữ cho giải chưa kết thúc" value={money(overview.tournament.feesHeld)} sub="Nợ phải trả hiện tại" />
          </div>
        </div>}

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold tracking-tight">Xu hướng theo ngày</h2>
          <FinanceTable
            data={trend.rows}
            columns={[
              { key: 'day', header: 'NGÀY', render: row => financeDate(row.day) },
              { key: 'cashIn', header: 'TIỀN VÀO', render: row => money(row.cashIn) },
              { key: 'cashOut', header: 'TIỀN RA', render: row => money(row.cashOut) },
              { key: 'revenue', header: 'DOANH THU', render: row => money(row.revenue) },
            ]}
            keyExtractor={row => row.day}
            emptyState={<TableEmpty>Không có dữ liệu xu hướng.</TableEmpty>}
          />
          {pager(trend.meta, 'ngày')}
        </div>

        <div>
          <Button type="button" variant="outline" onClick={() => void exportData('transactions')}>Xuất giao dịch Excel</Button>
        </div>
      </div>
    ) : <TableEmpty>Không có dữ liệu.</TableEmpty>;

  }

  function renderTransactions(): ReactNode {
    const columns: ColumnDef<FinanceTransaction>[] = [
      { key: 'time', header: 'THỜI GIAN', minWidth: 160, render: row => dateTime(row.occurredAt) },
      { key: 'source', header: 'NGUỒN', render: row => financeLabel(row.source) },
      { key: 'type', header: 'LOẠI', render: row => financeLabel(row.type) },
      { key: 'status', header: 'TRẠNG THÁI', render: row => <StatusBadge value={row.status} /> },
      { key: 'user', header: 'NGƯỜI DÙNG', render: row => `#${row.userId}` },
      { key: 'amount', header: 'SỐ TIỀN', render: row => <strong>{money(row.amount)}</strong> },
      { key: 'ref', header: 'THAM CHIẾU', render: row => row.referenceType ? `${financeLabel(row.referenceType)}:${row.referenceId ?? ''}` : '—' },
      { key: 'desc', header: 'DIỄN GIẢI', minWidth: 220, className: 'max-w-xs whitespace-normal', render: row => financeText(row.description, false) },
      {
        key: 'action', header: 'THAO TÁC', render: row => <Button type="button" variant="outline" className="h-9 px-3"
          onClick={() => void openTransactionDetail(row)}>Chi tiết</Button>,
      },
    ];
    return <div className="flex flex-col gap-4">
      <div>
        <Button type="button" variant="outline" onClick={() => void exportData('transactions')}>Xuất Excel</Button>
      </div>
      <FinanceTable data={transactions} columns={columns} keyExtractor={row => `${row.source}:${row.sourceId}`}
        emptyState={<TableEmpty>Không có giao dịch.</TableEmpty>} />
      {pager(transactionMeta)}
      {(detail !== null || detailLoading || detailError) && <ContentPanel title="Chi tiết giao dịch">
        <div className="flex justify-end">
          <Button type="button" variant="ghost" className="h-9 px-3" onClick={closeDetail}>Đóng</Button>
        </div>
        {detailLoading && <p role="status" className="text-sm text-muted-foreground">Đang tải chi tiết giao dịch…</p>}
        {detailError && <p role="alert" className="text-sm text-danger">{detailError}</p>}
        {detail !== null && <div className="max-h-80 overflow-auto rounded-lg bg-muted/40 p-3"><FinanceValue value={detail} /></div>}
      </ContentPanel>}
    </div>;

  }

  function renderWallets(): ReactNode {
    const columns: ColumnDef<WalletEntry>[] = [
      { key: 'time', header: 'THỜI GIAN', minWidth: 160, render: entry => dateTime(entry.createdAt) },
      { key: 'type', header: 'LOẠI', render: entry => financeLabel(entry.entryType) },
      { key: 'amount', header: 'SỐ TIỀN', render: entry => <strong>{money(entry.amount)}</strong> },
      { key: 'balance', header: 'SỐ DƯ SAU', render: entry => money(entry.balanceAfter) },
      { key: 'ref', header: 'THAM CHIẾU', render: entry => entry.referenceType ? `${financeLabel(entry.referenceType)}:${entry.referenceId ?? ''}` : '—' },
      { key: 'desc', header: 'DIỄN GIẢI', minWidth: 200, render: entry => financeText(entry.description, false) },
      { key: 'actor', header: 'NGƯỜI THỰC HIỆN', render: entry => entry.createdBy ?? '—' },
    ];
    return <div className="flex flex-col gap-4">
      {!wallet ? <TableEmpty>Tìm và chọn người dùng để xem ví.</TableEmpty> : <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Người dùng" value={`#${wallet.user.id}`} sub={wallet.user.email} />
          <KpiCard label="Số dư" value={money(wallet.balance)} />
          <KpiCard label="Đang tạm giữ" value={money(wallet.held)} />
          <KpiCard label="Khả dụng" value={money(wallet.available)} />
        </div>
        <FinanceTable data={walletEntries} columns={columns} keyExtractor={entry => entry.id}
          emptyState={<TableEmpty>Chưa có bút toán.</TableEmpty>} />
        {pager(walletMeta, 'bút toán')}
      </div>}
    </div>;

  }

  function renderTopUps(): ReactNode {
    const columns: ColumnDef<FinanceTopUp>[] = [
      { key: 'id', header: 'MÃ', render: row => `#${row.id}` },
      { key: 'user', header: 'NGƯỜI DÙNG', render: row => `#${row.userId}` },
      { key: 'amount', header: 'SỐ TIỀN', render: row => <strong>{money(row.amount)}</strong> },
      { key: 'status', header: 'TRẠNG THÁI', render: row => <StatusBadge value={row.status} /> },
      { key: 'provider', header: 'NHÀ CUNG CẤP', render: row => financeLabel(row.provider) },
      { key: 'ref', header: 'MÃ GIAO DỊCH', render: row => row.txnRef },
      { key: 'created', header: 'TẠO LÚC', minWidth: 160, render: row => dateTime(row.createdAt) },
      { key: 'paid', header: 'THANH TOÁN LÚC', minWidth: 160, render: row => dateTime(row.paidAt) },
      { key: 'match', header: 'THAO TÁC', render: row => row.status === 'PENDING' ? <Button type="button" variant="outline" onClick={() => { setMatchTopUp(row); setManualMatchOpen(true); }}>Ghép giao dịch</Button> : null },
    ];
    return <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => { setMatchTopUp(null); setManualMatchOpen(true); }}>Ghép giao dịch nạp tiền</Button>
        <Button type="button" variant="outline" onClick={() => void exportData('top-ups')}>Xuất Excel</Button>
      </div>
      <FinanceTable data={topUps} columns={columns} keyExtractor={row => row.id}
        emptyState={<TableEmpty>Không có giao dịch nạp tiền.</TableEmpty>} />
      {pager(topUpMeta, 'giao dịch nạp tiền')}
    </div>;

  }

  function renderPayouts(): ReactNode {
    const columns: ColumnDef<FinancePayout>[] = [
      { key: 'id', header: 'MÃ', render: row => `#${row.id}` },
      { key: 'user', header: 'NGƯỜI DÙNG', render: row => `#${row.userId}` },
      { key: 'type', header: 'LOẠI', render: row => financeLabel(row.requestType) },
      { key: 'amount', header: 'SỐ TIỀN', render: row => <strong>{money(row.amount)}</strong> },
      { key: 'status', header: 'TRẠNG THÁI', render: row => <StatusBadge value={row.status} /> },
      { key: 'created', header: 'TẠO LÚC', minWidth: 160, render: row => dateTime(row.createdAt) },
      { key: 'paid', header: 'ĐÃ CHI', minWidth: 160, render: row => dateTime(row.paidAt) },
      {
        key: 'actions', header: 'THAO TÁC', minWidth: 180, render: row => <div className="flex flex-wrap gap-2">
          {row.status === 'PENDING' && <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setPrompt({ kind: 'payout', payout: row, action: 'approve' })}>Duyệt</Button>}
          {row.status === 'PENDING' && <Button type="button" variant="danger-soft" className="h-9 px-3" onClick={() => setPrompt({ kind: 'payout', payout: row, action: 'reject' })}>Từ chối</Button>}
          {row.status === 'APPROVED' && <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setPrompt({ kind: 'payout', payout: row, action: 'paid' })}>Đã chi</Button>}
        </div>,
      },
    ];
    return <div className="flex flex-col gap-4">
      <div>
        <Button type="button" variant="outline" onClick={() => void exportData('payouts')}>Xuất Excel</Button>
      </div>
      <FinanceTable data={payouts} columns={columns} keyExtractor={row => row.id}
        rowClassName={row => row.id === payoutIdParam ? 'bg-accent/40' : undefined}
        emptyState={<TableEmpty>Không có yêu cầu chi trả.</TableEmpty>} />
      {pager(payoutMeta, 'yêu cầu chi trả')}
    </div>;

  }

  function renderRefunds(): ReactNode {
    const columns: ColumnDef<FinanceRefund>[] = [
      { key: 'payment', header: 'THANH TOÁN', render: row => `#${row.paymentId}` },
      { key: 'booking', header: 'ĐẶT SÂN', render: row => row.bookingId ? `#${row.bookingId}` : '—' },
      { key: 'user', header: 'NGƯỜI DÙNG', render: row => row.userId ? `#${row.userId}` : '—' },
      { key: 'amount', header: 'SỐ TIỀN', render: row => <strong>{money(row.amount)}</strong> },
      { key: 'status', header: 'TRẠNG THÁI', render: row => <StatusBadge value={row.status} /> },
      { key: 'attempts', header: 'LẦN THỬ', render: row => row.attempts },
      { key: 'error', header: 'LỖI GẦN NHẤT', minWidth: 220, className: 'max-w-xs whitespace-normal', render: row => row.lastError || '—' },
      { key: 'updated', header: 'CẬP NHẬT', minWidth: 160, render: row => dateTime(row.updatedAt) },
      {
        key: 'actions', header: 'THAO TÁC', minWidth: 180, render: row => <div className="flex flex-wrap gap-2">
          {row.status === 'FAILED' && <Button type="button" variant="outline" className="h-9 px-3" onClick={() => void retryRefund(row)}>Thử lại</Button>}
          <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setPrompt({ kind: 'refund', refund: row })}>Ghi chú</Button>
        </div>,
      },
    ];
    return <div className="flex flex-col gap-4">
      <div>
        <Button type="button" variant="outline" onClick={() => void exportData('refunds')}>Xuất Excel</Button>
      </div>
      <FinanceTable data={refunds} columns={columns} keyExtractor={row => row.paymentId}
        rowClassName={row => row.paymentId === paymentIdParam ? 'bg-accent/40' : undefined}
        emptyState={<TableEmpty>Không có yêu cầu hoàn tiền.</TableEmpty>} />
      {pager(refundMeta, 'yêu cầu hoàn tiền')}
    </div>;

  }

  function renderOwnerEarnings(): ReactNode {
    const settlementColumns: ColumnDef<FinanceOwnerEarningSettlement>[] = [
      { key: 'id', header: 'MÃ', render: row => `#${row.id}` },
      { key: 'booking', header: 'ĐẶT SÂN', minWidth: 180, render: row => row.bookingCode ? `${row.bookingCode} · #${row.bookingId}` : `#${row.bookingId}` },
      { key: 'owner', header: 'CHỦ SÂN', minWidth: 190, render: row => `#${row.ownerId} · ${row.ownerEmail}` },
      { key: 'amount', header: 'SỐ TIỀN', render: row => <strong>{money(row.amount)}</strong> },
      { key: 'status', header: 'TRẠNG THÁI', render: row => <StatusBadge value={row.status} /> },
      { key: 'mode', header: 'CHẾ ĐỘ', render: row => financeLabel(row.mode) },
      { key: 'created', header: 'TẠO LÚC', minWidth: 160, render: row => dateTime(row.createdAt) },
      {
        key: 'actions', header: 'THAO TÁC', minWidth: 210, render: row => <div className="flex flex-wrap items-center gap-2">
          {row.status === 'PENDING' && <Button type="button" variant="brand" className="h-9 px-3" onClick={() => setPrompt({ kind: 'settlement', settlement: row, action: 'approve' })}>Duyệt &amp; cộng ví</Button>}
          {row.status === 'PENDING' && <Button type="button" variant="danger-soft" className="h-9 px-3" onClick={() => setPrompt({ kind: 'settlement', settlement: row, action: 'reject' })}>Từ chối</Button>}
          {row.status !== 'PENDING' && <span className="text-xs text-muted-foreground">{row.note || '—'}</span>}
        </div>,
      },
    ];
    const earningColumns: ColumnDef<FinanceOwnerEarning>[] = [
      { key: 'id', header: 'MÃ', render: row => `#${row.id}` },
      { key: 'owner', header: 'CHỦ SÂN', minWidth: 190, render: row => `#${row.ownerId} · ${row.ownerEmail}` },
      { key: 'booking', header: 'ĐẶT SÂN', minWidth: 160, render: row => row.bookingId ? `#${row.bookingId}${row.bookingCode ? ` · ${row.bookingCode}` : ''}` : '—' },
      { key: 'type', header: 'LOẠI', render: row => financeLabel(row.entryType) },
      { key: 'amount', header: 'SỐ TIỀN', render: row => <strong>{money(row.amount)}</strong> },
      { key: 'balance', header: 'SỐ DƯ SAU', render: row => money(row.balanceAfter) },
      { key: 'desc', header: 'DIỄN GIẢI', minWidth: 200, render: row => financeText(row.description, false) },
      { key: 'time', header: 'THỜI GIAN', minWidth: 160, render: row => dateTime(row.createdAt) },
    ];
    return <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
        Khi cấu hình “Tự động cộng ví chủ sân” đang tắt, đặt sân hoàn tất sẽ nằm ở tab Chờ duyệt.
        Quản trị viên duyệt thì hệ thống cộng ví chủ sân; từ chối thì không cộng.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void runOwnerSweep(true)}>Chạy thử rà soát</Button>
        <Button type="button" variant="outline" onClick={() => void runOwnerSweep(false)}>Rà soát và cộng thu nhập</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={ownerEarningView === 'PENDING' ? 'brand' : 'outline'} className="h-9 px-3"
          onClick={() => { setOwnerEarningView('PENDING'); setPage(1); }}>Chờ duyệt ({ownerSettlementMeta.total})</Button>
        <Button type="button" variant={ownerEarningView === 'LEDGER' ? 'brand' : 'outline'} className="h-9 px-3"
          onClick={() => { setOwnerEarningView('LEDGER'); setPage(1); }}>Đã cộng</Button>
      </div>
      {ownerEarningView === 'PENDING' ? <div className="flex flex-col gap-4">
        <FinanceTable data={ownerSettlements} columns={settlementColumns} keyExtractor={row => row.id}
          rowClassName={row => row.id === settlementIdParam ? 'bg-accent/40' : undefined}
          emptyState={<TableEmpty>Chưa có quyết toán.</TableEmpty>} />
        {pager(ownerSettlementMeta, 'quyết toán')}
      </div> : <div className="flex flex-col gap-4">
        <FinanceTable data={ownerEarnings} columns={earningColumns} keyExtractor={row => row.id}
          emptyState={<TableEmpty>Chưa có thu nhập chủ sân.</TableEmpty>} />
        {pager(ownerEarningMeta, 'bút toán thu nhập')}
      </div>}
    </div>;

  }

  function renderReconciliation(): ReactNode {
    const activeDiscrepancyType = reconciliation?.discrepancies.some(row => row.type === discrepancyType) ? discrepancyType : '';
    const discrepancies = financePage((reconciliation?.discrepancies ?? []).filter(row => !activeDiscrepancyType || row.type === activeDiscrepancyType), page, limit);
    const columns: ColumnDef<FinanceReconciliation['discrepancies'][number]>[] = [
      { key: 'key', header: 'MÃ ĐỐI SOÁT', minWidth: 180, render: row => financeDate(financeLabel(row.key)) },
      { key: 'type', header: 'LOẠI', render: row => financeLabel(row.type) },
      { key: 'entity', header: 'ĐỐI TƯỢNG', minWidth: 160, render: row => `${financeLabel(row.entityType)}${row.entityId ? `:${row.entityId}` : ''}` },
      { key: 'expected', header: 'DỰ KIẾN', render: row => financeText(row.expected) },
      { key: 'actual', header: 'THỰC TẾ', render: row => financeText(row.actual) },
      { key: 'delta', header: 'CHÊNH LỆCH', render: row => row.delta },
      { key: 'message', header: 'THÔNG ĐIỆP', minWidth: 240, className: 'max-w-sm whitespace-normal', render: row => discrepancyMessage(row) },
      {
        key: 'actions', header: 'THAO TÁC', render: row => <Button type="button" variant="outline" className="h-9 px-3"
          onClick={() => setPrompt(row.type === 'OWNER_EARNING_REVERSAL_PENDING' ? { kind: 'reversal', bookingId: Number(row.entityId) } : { kind: 'discrepancy', key: row.key })}>{row.type === 'OWNER_EARNING_REVERSAL_PENDING' ? 'Thử lại thu hồi' : 'Xử lý'}</Button>,
      },
    ];
    return <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void load()}>Chạy đối soát</Button>
        <Button type="button" variant="outline" onClick={() => void exportData('reconciliation')}>Xuất Excel</Button>
      </div>
      {!reconciliation ? <TableEmpty>Chưa chạy đối soát.</TableEmpty> : <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard label="Số mục kiểm tra" value={reconciliation.summary.checks} />
          <KpiCard label="Lệch" value={reconciliation.summary.failed} />
          <KpiCard label="Đã giới hạn kết quả" value={reconciliation.summary.truncated ? 'Có' : 'Không'} />
        </div>
        <FilterControl label="Loại chênh lệch">
          <Select value={activeDiscrepancyType} onChange={value => { setDiscrepancyType(value); setPage(1); }} options={[
            { value: '', label: 'Tất cả loại chênh lệch' },
            ...[...new Set(reconciliation.discrepancies.map(row => row.type))].map(value => ({ value, label: financeLabel(value) })),
          ]} />
        </FilterControl>
        <FinanceTable data={discrepancies.rows} columns={columns} keyExtractor={row => row.key}
          emptyState={<TableEmpty>Không phát hiện lệch.</TableEmpty>} />
        {pager(discrepancies.meta, 'chênh lệch')}
      </div>}
    </div>;

  }

  function renderReports(): ReactNode {
    const reportPage = financePage(report?.rows ?? [], page, limit);
    const columns: ColumnDef<FinanceReport['rows'][number]>[] = [
      { key: 'key', header: 'NHÓM', minWidth: 160, render: row => financeDate(financeLabel(row.key)) },
      { key: 'label', header: 'NHÃN', minWidth: 180, render: row => financeDate(financeLabel(row.label)) },
      { key: 'gross', header: 'TỔNG DOANH THU', render: row => money(row.gross) },
      { key: 'refunds', header: 'HOÀN TIỀN', render: row => money(row.refunds) },
      { key: 'net', header: 'DOANH THU RÒNG ƯỚC TÍNH', render: row => money(row.net) },
      { key: 'owner', header: 'THU NHẬP CHỦ SÂN', render: row => money(row.ownerEarnings) },
    ];
    return <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void exportData('revenue')}>Xuất doanh thu</Button>
        <Button type="button" variant="outline" onClick={() => void exportData('cash-flow')}>Xuất dòng tiền</Button>
      </div>
      {!report ? <TableEmpty>Không có báo cáo.</TableEmpty> : <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard label="Tổng doanh thu" value={money(report.totals.grossRevenue)} />
          <KpiCard label="Hoàn tiền" value={money(report.totals.refunds)} />
          <KpiCard label="Doanh thu ròng ước tính" value={money(report.totals.netEstimated)} />
          <KpiCard label="Thu nhập chủ sân" value={money(report.totals.ownerEarnings)} />
          <KpiCard label="Tiền vào" value={money(report.totals.cashIn)} />
          <KpiCard label="Tiền ra" value={money(report.totals.cashOut)} />
        </div>
        <FinanceTable data={reportPage.rows} columns={columns} keyExtractor={row => row.key}
          emptyState={<TableEmpty>Không có dữ liệu trong kỳ.</TableEmpty>} />
        {pager(reportPage.meta, 'nhóm báo cáo')}
        <p className="text-xs text-muted-foreground">Doanh thu là số ước tính vận hành, không phải số kế toán/quyết toán.</p>
      </div>}
    </div>;

  }

  function renderAudit(): ReactNode {
    const columns: ColumnDef<FinanceAudit>[] = [
      { key: 'time', header: 'THỜI GIAN', minWidth: 160, render: row => dateTime(row.createdAt) },
      { key: 'actor', header: 'NGƯỜI THỰC HIỆN', render: row => `#${row.actorId}` },
      { key: 'action', header: 'HÀNH ĐỘNG', minWidth: 180, render: row => financeLabel(row.action) },
      { key: 'entity', header: 'ĐỐI TƯỢNG', minWidth: 160, render: row => `${financeLabel(row.entityType)}${row.entityId ? `:${row.entityId}` : ''}` },
      { key: 'metadata', header: 'THÔNG TIN BỔ SUNG', minWidth: 280, className: 'max-w-lg whitespace-normal text-xs', render: row => <FinanceValue value={row.metadata} /> },
    ];
    return <div className="flex flex-col gap-4">
      <FinanceTable data={audits} columns={columns} keyExtractor={row => row.id}
        emptyState={<TableEmpty>Chưa có nhật ký thao tác.</TableEmpty>} />
      {pager(auditMeta, 'bản ghi')}
    </div>;

  }

  const sectionViews: Partial<Record<FinanceSection, () => ReactNode>> = {
    'overview': renderOverview,
    'transactions': renderTransactions,
    'wallets': renderWallets,
    'top-ups': renderTopUps,
    'payouts': renderPayouts,
    'refunds': renderRefunds,
    'owner-earnings': renderOwnerEarnings,
    'reconciliation': renderReconciliation,
    'reports': renderReports,
  };
  const body: ReactNode = loading ? renderLoading() : error ? renderError() : (sectionViews[section] ?? renderAudit)();

  const promptConfig = prompt ? financePromptConfig(prompt) : null;

  return (
    <div className="flex min-h-svh bg-background font-sans text-foreground">
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(value => !value)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />
      <AdminMain isCollapsed={isCollapsed}>
        <AdminHeader isCollapsed={isCollapsed} onToggleMobileSidebar={() => setIsMobileOpen(true)} />
        <main id="admin-main-content" tabIndex={-1}
          className="mx-auto flex w-full min-w-0 max-w-360 flex-col gap-6 px-4 pb-16 pt-24 sm:px-6">
          <PageHeader
            title="Quản lý tài chính"
            description="Vận hành ví, nạp tiền, chi trả, hoàn tiền, thu nhập chủ sân, đối soát và báo cáo."
          />
          <nav aria-label="Mục quản lý tài chính" className="flex flex-wrap gap-2">
            {SECTIONS.map(item => (
              <Button key={item.key} asChild variant={item.key === activeSection.key ? 'brand' : 'outline'} className="h-9 px-3">
                <Link to={item.path} aria-current={item.key === activeSection.key ? 'page' : undefined}>{item.label}</Link>
              </Button>
            ))}
          </nav>
          {section === 'wallets' ? walletTools : filterBar}
          {body}
        </main>
      </AdminMain>
      <WalletAdjustmentDialog
        open={walletDialogKind !== null}
        kind={walletDialogKind ?? 'credit'}
        userId={walletId}
        onClose={() => setWalletDialogKind(null)}
        onSubmit={payload => submitWalletAdjustment(walletDialogKind ?? 'credit', payload)}
      />
      <ManualMatchDialog
        initialTopUp={matchTopUp}
        open={manualMatchOpen}
        onClose={() => setManualMatchOpen(false)}
        onSubmit={submitManualMatch}
      />
      {prompt && promptConfig && <PromptDialog
        title={promptConfig.title}
        description={promptConfig.description}
        label={promptConfig.label}
        required={promptConfig.required}
        requiredMessage={promptConfig.requiredMessage}
        confirmLabel={promptConfig.confirmLabel}
        tone={promptConfig.tone}
        multiline={promptConfig.multiline}
        maxLength={prompt.kind === 'payout' ? (prompt.action === 'paid' ? 120 : 200) : prompt.kind === 'reversal' ? 200 : 500}
        onClose={() => setPrompt(null)}
        onSubmit={value => submitPrompt(prompt, value)}
      />}
      <ToastContainer toasts={toasts} onRemove={id => setToasts(current => current.filter(toast => toast.id !== id))} />
    </div>
  );
};

type WalletToolsProps = {
  walletId: string;
  load: () => Promise<void>;
  walletSelectionRef: React.RefObject<string>;
  setWalletId: React.Dispatch<React.SetStateAction<string>>;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  setWallet: React.Dispatch<React.SetStateAction<FinanceWallet | null>>;
  setWalletEntries: React.Dispatch<React.SetStateAction<FinanceWalletEntry[]>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  wallet: FinanceWallet | null;
  loading: boolean;
  setWalletDialogKind: React.Dispatch<React.SetStateAction<"credit" | "debit" | null>>;
};

function WalletTools({
  walletId,
  load,
  walletSelectionRef,
  setWalletId,
  setPage,
  setWallet,
  setWalletEntries,
  setError,
  wallet,
  loading,
  setWalletDialogKind,
}: WalletToolsProps) {
  return <WalletUserSearch selectedId={walletId} onRefresh={() => void load()}
    onSelect={id => { walletSelectionRef.current = id; setWalletId(id); setPage(1); setWallet(null); setWalletEntries([]); }}
    onClear={() => { walletSelectionRef.current = ''; setWalletId(''); setWallet(null); setWalletEntries([]); setError(''); }}
    actions={<>
      <Button type="button" variant="outline" disabled={!walletId || !wallet || loading} onClick={() => setWalletDialogKind('credit')}>Cộng ví</Button>
      <Button type="button" variant="outline" disabled={!walletId || !wallet || loading} onClick={() => setWalletDialogKind('debit')}>Trừ ví</Button>
    </>} />;
}

type FinanceFiltersProps = {
  section: string;
  range: string;
  setRange: React.Dispatch<React.SetStateAction<string>>;
  setCustomPeriod: React.Dispatch<React.SetStateAction<{ startDate?: string; endDate?: string; }>>;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  sourceFilter: string;
  setSourceFilter: React.Dispatch<React.SetStateAction<string>>;
  groupBy: string;
  setGroupBy: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  load: () => Promise<void>;
  customPeriod: { startDate?: string; endDate?: string; };
  extraFilters: FinanceListFilters;
  setFilterState: React.Dispatch<React.SetStateAction<{ section: string; values: FinanceListFilters; }>>;
};

function FinanceFilters({
  section,
  range,
  setRange,
  setCustomPeriod,
  setPage,
  statusFilter,
  setStatusFilter,
  sourceFilter,
  setSourceFilter,
  groupBy,
  setGroupBy,
  loading,
  load,
  customPeriod,
  extraFilters,
  setFilterState,
}: FinanceFiltersProps) {
  return <div className="grid min-w-0 grid-cols-1 items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
    {['overview', 'reports', 'reconciliation'].includes(section) && <FilterControl label="Khoảng thời gian">
      <Select value={range} aria-label="Khoảng thời gian"
        onChange={value => { setRange(value); setCustomPeriod({}); setPage(1); }} options={[
          { value: 'today', label: 'Hôm nay' },
          ...(range === 'custom' ? [{ value: 'custom', label: 'Khoảng ngày đã chọn' }] : []),
          { value: '7d', label: '7 ngày' },
          { value: '30d', label: '30 ngày' },
          { value: 'this_month', label: 'Tháng này' },
        ]} />
    </FilterControl>}

    {(section === 'transactions' || section === 'audit') && (
      <FilterControl label="Trạng thái / hành động">
        <Select value={statusFilter} aria-label="Lọc theo trạng thái hoặc hành động"
          onChange={value => { setStatusFilter(value); setPage(1); }} options={[
            { value: '', label: 'Tất cả trạng thái / hành động' },
            ...(section === 'transactions'
              ? ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'EXPIRED', 'APPROVED', 'REJECTED', 'PAID', 'REFUNDED', 'POSTED']
              : ['EXPORT', 'WALLET_CREDIT', 'WALLET_DEBIT', 'PAYOUT_APPROVE', 'PAYOUT_REJECT', 'PAYOUT_MARK_PAID', 'REFUND_RETRY', 'REFUND_RESOLVE', 'OWNER_EARNING_SWEEP', 'OWNER_EARNING_APPROVE', 'OWNER_EARNING_REJECT', 'OWNER_EARNING_REVERSAL', 'TOP_UP_MANUAL_MATCH', 'RECONCILIATION_RESOLVE']).map(value => ({ value, label: financeLabel(value) })),
          ]} />
      </FilterControl>
    )}

    {section === 'transactions' && (
      <FilterControl label="Nguồn">
        <Select value={sourceFilter} aria-label="Lọc theo nguồn"
          onChange={value => { setSourceFilter(value); setPage(1); }} options={[
            { value: '', label: 'Tất cả nguồn' },
            { value: 'ledger', label: 'Sổ giao dịch ví' },
            { value: 'top-up', label: 'Nạp tiền' },
            { value: 'payout', label: 'Chi trả' },
            { value: 'refund', label: 'Hoàn tiền' },
          ]} />
      </FilterControl>
    )}

    {['top-ups', 'payouts', 'refunds'].includes(section) && (
      <FilterControl label="Trạng thái">
        <Select value={statusFilter} aria-label="Lọc theo trạng thái"
          onChange={value => { setStatusFilter(value); setPage(1); }} options={[
            { value: '', label: 'Tất cả trạng thái' },
            ...(section === 'top-ups' ? ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED']
              : section === 'payouts' ? ['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'FAILED']
                : ['PENDING', 'PROCESSING', 'REFUNDED', 'FAILED']).map(value => ({ value, label: financeLabel(value) })),
          ]} />
      </FilterControl>
    )}

    {section === 'reports' && (
      <FilterControl label="Nhóm báo cáo">
        <Select value={groupBy} aria-label="Nhóm báo cáo"
          onChange={value => { setGroupBy(value); setPage(1); }} options={[
            { value: 'day', label: 'Theo ngày' },
            { value: 'source', label: 'Theo nguồn' },
            { value: 'owner', label: 'Theo chủ sân' },
          ]} />
      </FilterControl>
    )}

    <Button type="button" variant="outline" className="h-11" disabled={loading} onClick={() => void load()}>
      <RefreshCw aria-hidden="true" />
      Làm mới
    </Button>
    {range === 'custom' && ['overview', 'reports', 'reconciliation'].includes(section) && <p className="col-span-full text-sm text-muted-foreground">Đang xem: {financeDate(customPeriod.startDate ?? '')} – {financeDate(customPeriod.endDate ?? '')}</p>}
    {['overview', 'reports', 'reconciliation'].includes(section) && <FinancePeriodFilter onApply={period => { setCustomPeriod(period); setRange('custom'); setPage(1); }} />}
    {['transactions', 'top-ups', 'payouts', 'refunds', 'owner-earnings', 'audit'].includes(section) &&
      <FinanceAdvancedFilters key={section} section={section} initialValues={extraFilters} onApply={values => { setFilterState({ section, values }); setPage(1); }} />}
  </div>;
}
