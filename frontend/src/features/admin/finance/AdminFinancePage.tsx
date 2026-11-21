import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { AdminHeader } from '../components/AdminHeader';
import { AdminSidebar } from '../components/AdminSidebar';
import { TablePagination } from '../components/TablePagination';
import { AdminMain } from '../components/AdminMain';
import { PageHeader } from '@/components/common/page-layout';
import { EmptyState } from '@/components/common/empty-state';
import type { ColumnDef } from '@/components/common/data-table';
import { ContentPanel } from '@/components/common/content-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToastContainer, type ToastMessage } from '../components/Toast';
import { ApiError } from '../../../shared/api/http-client';
import { financeLabel, financeText, financeDate, discrepancyMessage } from './finance-labels';
import { FinancePeriodFilter } from './finance-period-filter';
import { WalletUserSearch } from './wallet-user-search';
import { FinanceTable } from './finance-table';
import { FinanceValue } from './finance-value';
import { FinanceAdvancedFilters, type FinanceListFilters } from './finance-list-filters';
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
    setLoading(true);
    setError('');
    try {
      if (section === 'overview') {
        const response = await adminFinanceService.overview({ range, ...customPeriod });
        if (!isCurrent()) return;
        setOverview(response);
      } else if (section === 'transactions') {
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
      } else if (section === 'wallets') {
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
      } else if (section === 'top-ups') {
        const response = await adminFinanceService.topUps({ ...extraFilters, status: statusFilter || undefined, page: requestPage, limit: requestLimit });
        if (!isCurrent()) return;
        setTopUps(response.data);
        setTopUpMeta(response.meta);
      } else if (section === 'payouts') {
        const response = await adminFinanceService.payouts({ ...extraFilters, status: statusFilter || undefined, page: requestPage, limit: requestLimit });
        if (!isCurrent()) return;
        setPayouts(response.data);
        setPayoutMeta(response.meta);
      } else if (section === 'refunds') {
        const response = await adminFinanceService.refunds({ ...extraFilters, status: statusFilter || undefined, page: requestPage, limit: requestLimit });
        if (!isCurrent()) return;
        setRefunds(response.data);
        setRefundMeta(response.meta);
      } else if (section === 'owner-earnings') {
        const [history, settlements] = await Promise.all([
          adminFinanceService.ownerEarnings({ ...extraFilters, page: requestPage, limit: requestLimit }),
          adminFinanceService.ownerEarningSettlements({ ...extraFilters, status: 'PENDING', page: requestPage, limit: requestLimit }),
        ]);
        if (!isCurrent()) return;
        setOwnerEarnings(history.data);
        setOwnerEarningMeta(history.meta);
        setOwnerSettlements(settlements.data);
        setOwnerSettlementMeta(settlements.meta);
      } else if (section === 'reconciliation') {
        const response = await adminFinanceService.reconciliation({ range, ...customPeriod });
        if (!isCurrent()) return;
        setReconciliation(response);
      } else if (section === 'reports') {
        const response = await adminFinanceService.revenue({ range, groupBy, ...customPeriod });
        if (!isCurrent()) return;
        setReport(response);
      } else if (section === 'audit') {
        const response = await adminFinanceService.audit({ ...extraFilters, page: requestPage, limit: requestLimit, action: statusFilter || undefined });
        if (!isCurrent()) return;
        setAudits(response.data);
        setAuditMeta(response.meta);
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

  const walletAction = async (kind: 'credit' | 'debit') => {
    const id = Number(walletId);
    if (!id) return notify('Nhập mã người dùng trước.');
    const amount = window.prompt(`Số tiền ${kind === 'credit' ? 'cộng' : 'trừ'} (VND)`);
    if (!amount?.trim()) return;
    const reason = window.prompt('Lý do (bắt buộc)');
    if (!reason?.trim()) return;
    try {
      if (kind === 'credit') await adminFinanceService.creditWallet(id, { amount: amount.trim(), reason: reason.trim() });
      else await adminFinanceService.debitWallet(id, { amount: amount.trim(), reason: reason.trim() });
      notify(kind === 'credit' ? 'Đã cộng ví.' : 'Đã trừ ví.');
      await reloadCurrentRef.current();
    } catch (err) {
      setError(errorMessage(err, 'Không thể điều chỉnh ví.'));
    }
  };

  const payoutAction = async (payout: FinancePayout, action: 'approve' | 'reject' | 'paid') => {
    try {
      if (action === 'approve') {
        const note = window.prompt('Ghi chú duyệt (không bắt buộc)');
        if (note === null) return;
        await adminFinanceService.approvePayout(payout.id, note.trim() || undefined);
      } else if (action === 'reject') {
        const note = window.prompt('Lý do từ chối (bắt buộc)');
        if (!note?.trim()) return;
        await adminFinanceService.rejectPayout(payout.id, note.trim());
      } else {
        const reference = window.prompt('Mã giao dịch chuyển khoản (bắt buộc)');
        if (!reference?.trim()) return;
        await adminFinanceService.markPayoutPaid(payout.id, reference.trim());
      }
      notify(`Đã cập nhật yêu cầu chi trả #${payout.id}.`);
      await reloadCurrentRef.current();
    } catch (err) {
      setError(errorMessage(err, 'Không thể cập nhật yêu cầu chi trả.'));
    }
  };

  const manualMatch = async () => {
    const provider = window.prompt('Nhà cung cấp (SEPAY/MOCK/VNPAY)');
    if (!provider?.trim()) return;
    const providerReference = window.prompt('Mã giao dịch ngân hàng');
    if (!providerReference?.trim()) return;
    const amount = window.prompt('Số tiền (VND)');
    if (!amount?.trim()) return;
    const userId = window.prompt('Mã người dùng nhận tiền');
    if (!userId?.trim()) return;
    const reason = window.prompt('Lý do ghép tay');
    if (!reason?.trim()) return;
    try {
      await adminFinanceService.manualMatchTopUp({
        provider: provider.trim(),
        providerReference: providerReference.trim(),
        amount: amount.trim(),
        userId: Number(userId),
        reason: reason.trim(),
      });
      notify('Đã ghép giao dịch nạp tiền.');
      await reloadCurrentRef.current();
    } catch (err) {
      setError(errorMessage(err, 'Không thể ghép giao dịch nạp tiền.'));
    }
  };

  const retryRefund = async (refund: FinanceRefund) => {
    try {
      await adminFinanceService.retryRefund(refund.paymentId);
      notify(`Đã thử lại hoàn tiền #${refund.paymentId}.`);
      await reloadCurrentRef.current();
    } catch (err) {
      setError(errorMessage(err, 'Không thể thử lại hoàn tiền.'));
    }
  };

  const resolveRefund = async (refund: FinanceRefund) => {
    const note = window.prompt('Ghi chú xử lý (bắt buộc)');
    if (!note?.trim()) return;
    try {
      await adminFinanceService.resolveRefund(refund.paymentId, note.trim());
      notify('Đã ghi chú xử lý hoàn tiền.');
      await reloadCurrentRef.current();
    } catch (err) {
      setError(errorMessage(err, 'Không thể ghi chú hoàn tiền.'));
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
      setError(errorMessage(err, 'Không thể rà soát thu nhập chủ sân.'));
    }
  };

  const ownerSettlementAction = async (settlement: FinanceOwnerEarningSettlement, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        const note = window.prompt('Ghi chú duyệt (không bắt buộc)');
        if (note === null) return;
        await adminFinanceService.approveOwnerEarningSettlement(settlement.id, note.trim() || undefined);
        notify(`Đã duyệt và cộng ví chủ sân cho quyết toán #${settlement.id}.`);
      } else {
        const reason = window.prompt('Lý do từ chối (bắt buộc)');
        if (!reason?.trim()) return;
        await adminFinanceService.rejectOwnerEarningSettlement(settlement.id, reason.trim());
        notify(`Đã từ chối quyết toán #${settlement.id}.`);
      }
      await reloadCurrentRef.current();
    } catch (err) {
      setError(errorMessage(err, 'Không thể xử lý thu nhập chủ sân.'));
    }
  };

  const resolveDiscrepancy = async (key: string) => {
    const note = window.prompt('Ghi chú xử lý lệch (bắt buộc)');
    if (!note?.trim()) return;
    try {
      await adminFinanceService.resolveReconciliation(key, note.trim());
      notify('Đã ghi nhận xử lý lệch.');
      await reloadCurrentRef.current();
    } catch (err) {
      setError(errorMessage(err, 'Không thể xử lý lệch.'));
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
      setError(errorMessage(err, 'Không thể xuất Excel.'));
    }
  };

  const pager = (meta: FinancePageMeta, totalLabel = 'giao dịch') => <TablePagination
    page={meta.page} limit={limit} total={meta.total} totalPages={meta.totalPages} totalLabel={totalLabel}
    onPageChange={setPage} onLimitChange={value => { setLimit(value); setPage(1); }} />;

  const walletTools = <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
    <WalletUserSearch selectedId={walletId} onRefresh={() => void load()}
      onSelect={id => { walletSelectionRef.current = id; setWalletId(id); setPage(1); setWallet(null); setWalletEntries([]); }}
      onClear={() => { walletSelectionRef.current = ''; setWalletId(''); setWallet(null); setWalletEntries([]); setError(''); }}
      actions={<>
      <Button type="button" variant="outline" disabled={!walletId || !wallet || loading} onClick={() => void walletAction('credit')}>Cộng ví</Button>
      <Button type="button" variant="outline" disabled={!walletId || !wallet || loading} onClick={() => void walletAction('debit')}>Trừ ví</Button>
      </>} />
  </div>;

  const filterBar = (
    <div className="grid min-w-0 grid-cols-1 items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
      {['overview', 'reports', 'reconciliation'].includes(section) && <FilterControl label="Khoảng thời gian">
        <NativeSelect value={range} aria-label="Khoảng thời gian"
          onChange={event => { setRange(event.target.value); setCustomPeriod({}); setPage(1); }} className="h-11 w-full">
          <option value="today">Hôm nay</option>
          {range === 'custom' && <option value="custom">Khoảng ngày đã chọn</option>}
          <option value="7d">7 ngày</option>
          <option value="30d">30 ngày</option>
          <option value="this_month">Tháng này</option>
        </NativeSelect>
      </FilterControl>}

      {(section === 'transactions' || section === 'audit') && (
        <FilterControl label="Trạng thái / hành động">
          <NativeSelect value={statusFilter} aria-label="Lọc theo trạng thái hoặc hành động"
            onChange={event => { setStatusFilter(event.target.value); setPage(1); }} className="h-11 w-full">
            <option value="">Tất cả trạng thái / hành động</option>
            {section === 'transactions' ? (
              <>
                {['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'EXPIRED', 'APPROVED', 'REJECTED', 'PAID', 'REFUNDED', 'POSTED'].map(value => <option key={value} value={value}>{financeLabel(value)}</option>)}
              </>
            ) : (
              <>
                {['EXPORT', 'WALLET_CREDIT', 'WALLET_DEBIT', 'PAYOUT_APPROVE', 'PAYOUT_REJECT', 'PAYOUT_MARK_PAID', 'REFUND_RETRY', 'REFUND_RESOLVE', 'OWNER_EARNING_SWEEP', 'OWNER_EARNING_APPROVE', 'OWNER_EARNING_REJECT', 'OWNER_EARNING_REVERSAL', 'TOP_UP_MANUAL_MATCH', 'RECONCILIATION_RESOLVE'].map(value => <option key={value} value={value}>{financeLabel(value)}</option>)}
              </>
            )}
          </NativeSelect>
        </FilterControl>
      )}

      {section === 'transactions' && (
        <FilterControl label="Nguồn">
          <NativeSelect value={sourceFilter} aria-label="Lọc theo nguồn"
            onChange={event => { setSourceFilter(event.target.value); setPage(1); }} className="h-11 w-full">
            <option value="">Tất cả nguồn</option>
            <option value="ledger">Sổ giao dịch ví</option>
            <option value="top-up">Nạp tiền</option>
            <option value="payout">Chi trả</option>
            <option value="refund">Hoàn tiền</option>
          </NativeSelect>
        </FilterControl>
      )}

      {['top-ups', 'payouts', 'refunds'].includes(section) && (
        <FilterControl label="Trạng thái">
          <NativeSelect value={statusFilter} aria-label="Lọc theo trạng thái"
            onChange={event => { setStatusFilter(event.target.value); setPage(1); }} className="h-11 w-full">
            <option value="">Tất cả trạng thái</option>
            {section === 'top-ups' && ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'].map(value => <option key={value} value={value}>{financeLabel(value)}</option>)}
            {section === 'payouts' && ['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'FAILED'].map(value => <option key={value} value={value}>{financeLabel(value)}</option>)}
            {section === 'refunds' && ['PENDING', 'PROCESSING', 'REFUNDED', 'FAILED'].map(value => <option key={value} value={value}>{financeLabel(value)}</option>)}
          </NativeSelect>
        </FilterControl>
      )}

      {section === 'reports' && (
        <FilterControl label="Nhóm báo cáo">
          <NativeSelect value={groupBy} aria-label="Nhóm báo cáo"
            onChange={event => { setGroupBy(event.target.value); setPage(1); }} className="h-11 w-full">
            <option value="day">Theo ngày</option>
            <option value="source">Theo nguồn</option>
            <option value="owner">Theo chủ sân</option>
          </NativeSelect>
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
    </div>
  );

  let body: ReactNode;
  if (loading) {
    body = <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">Đang tải dữ liệu…</span>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>;
  } else if (error) {
    body = <EmptyState role="alert" icon={CircleAlert} title="Không tải được dữ liệu tài chính" description={error} />;
  } else if (section === 'overview') {
    const trend = financePage((overview?.trend.cashIn ?? []).map(row => ({
      day: row.day, cashIn: row.amount,
      cashOut: overview?.trend.cashOut.find(item => item.day === row.day)?.amount,
      revenue: overview?.trend.revenue.find(item => item.day === row.day)?.amount,
    })), page, limit);
    body = overview ? (
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
  } else if (section === 'transactions') {
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
    body = <div className="flex flex-col gap-4">
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
  } else if (section === 'wallets') {
    const columns: ColumnDef<WalletEntry>[] = [
      { key: 'time', header: 'THỜI GIAN', minWidth: 160, render: entry => dateTime(entry.createdAt) },
      { key: 'type', header: 'LOẠI', render: entry => financeLabel(entry.entryType) },
      { key: 'amount', header: 'SỐ TIỀN', render: entry => <strong>{money(entry.amount)}</strong> },
      { key: 'balance', header: 'SỐ DƯ SAU', render: entry => money(entry.balanceAfter) },
      { key: 'ref', header: 'THAM CHIẾU', render: entry => entry.referenceType ? `${financeLabel(entry.referenceType)}:${entry.referenceId ?? ''}` : '—' },
      { key: 'desc', header: 'DIỄN GIẢI', minWidth: 200, render: entry => financeText(entry.description, false) },
      { key: 'actor', header: 'NGƯỜI THỰC HIỆN', render: entry => entry.createdBy ?? '—' },
    ];
    body = <div className="flex flex-col gap-4">
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
  } else if (section === 'top-ups') {
    const columns: ColumnDef<FinanceTopUp>[] = [
      { key: 'id', header: 'MÃ', render: row => `#${row.id}` },
      { key: 'user', header: 'NGƯỜI DÙNG', render: row => `#${row.userId}` },
      { key: 'amount', header: 'SỐ TIỀN', render: row => <strong>{money(row.amount)}</strong> },
      { key: 'status', header: 'TRẠNG THÁI', render: row => <StatusBadge value={row.status} /> },
      { key: 'provider', header: 'NHÀ CUNG CẤP', render: row => financeLabel(row.provider) },
      { key: 'ref', header: 'MÃ GIAO DỊCH', render: row => row.txnRef },
      { key: 'created', header: 'TẠO LÚC', minWidth: 160, render: row => dateTime(row.createdAt) },
      { key: 'paid', header: 'THANH TOÁN LÚC', minWidth: 160, render: row => dateTime(row.paidAt) },
    ];
    body = <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void manualMatch()}>Ghép giao dịch nạp tiền</Button>
        <Button type="button" variant="outline" onClick={() => void exportData('top-ups')}>Xuất Excel</Button>
      </div>
      <FinanceTable data={topUps} columns={columns} keyExtractor={row => row.id}
        emptyState={<TableEmpty>Không có giao dịch nạp tiền.</TableEmpty>} />
      {pager(topUpMeta, 'giao dịch nạp tiền')}
    </div>;
  } else if (section === 'payouts') {
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
          {row.status === 'PENDING' && <Button type="button" variant="outline" className="h-9 px-3" onClick={() => void payoutAction(row, 'approve')}>Duyệt</Button>}
          {row.status === 'PENDING' && <Button type="button" variant="danger-soft" className="h-9 px-3" onClick={() => void payoutAction(row, 'reject')}>Từ chối</Button>}
          {row.status === 'APPROVED' && <Button type="button" variant="outline" className="h-9 px-3" onClick={() => void payoutAction(row, 'paid')}>Đã chi</Button>}
        </div>,
      },
    ];
    body = <div className="flex flex-col gap-4">
      <div>
        <Button type="button" variant="outline" onClick={() => void exportData('payouts')}>Xuất Excel</Button>
      </div>
      <FinanceTable data={payouts} columns={columns} keyExtractor={row => row.id}
        rowClassName={row => row.id === payoutIdParam ? 'bg-accent/40' : undefined}
        emptyState={<TableEmpty>Không có yêu cầu chi trả.</TableEmpty>} />
      {pager(payoutMeta, 'yêu cầu chi trả')}
    </div>;
  } else if (section === 'refunds') {
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
          <Button type="button" variant="outline" className="h-9 px-3" onClick={() => void resolveRefund(row)}>Ghi chú</Button>
        </div>,
      },
    ];
    body = <div className="flex flex-col gap-4">
      <div>
        <Button type="button" variant="outline" onClick={() => void exportData('refunds')}>Xuất Excel</Button>
      </div>
      <FinanceTable data={refunds} columns={columns} keyExtractor={row => row.paymentId}
        rowClassName={row => row.paymentId === paymentIdParam ? 'bg-accent/40' : undefined}
        emptyState={<TableEmpty>Không có yêu cầu hoàn tiền.</TableEmpty>} />
      {pager(refundMeta, 'yêu cầu hoàn tiền')}
    </div>;
  } else if (section === 'owner-earnings') {
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
          {row.status === 'PENDING' && <Button type="button" variant="brand" className="h-9 px-3" onClick={() => void ownerSettlementAction(row, 'approve')}>Duyệt &amp; cộng ví</Button>}
          {row.status === 'PENDING' && <Button type="button" variant="danger-soft" className="h-9 px-3" onClick={() => void ownerSettlementAction(row, 'reject')}>Từ chối</Button>}
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
    body = <div className="flex flex-col gap-4">
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
  } else if (section === 'reconciliation') {
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
          onClick={() => void resolveDiscrepancy(row.key)}>Xử lý</Button>,
      },
    ];
    body = <div className="flex flex-col gap-4">
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
          <NativeSelect value={activeDiscrepancyType} onChange={event => { setDiscrepancyType(event.target.value); setPage(1); }}>
            <option value="">Tất cả loại chênh lệch</option>
            {[...new Set(reconciliation.discrepancies.map(row => row.type))].map(value => <option key={value} value={value}>{financeLabel(value)}</option>)}
          </NativeSelect>
        </FilterControl>
        <FinanceTable data={discrepancies.rows} columns={columns} keyExtractor={row => row.key}
          emptyState={<TableEmpty>Không phát hiện lệch.</TableEmpty>} />
        {pager(discrepancies.meta, 'chênh lệch')}
      </div>}
    </div>;
  } else if (section === 'reports') {
    const reportPage = financePage(report?.rows ?? [], page, limit);
    const columns: ColumnDef<FinanceReport['rows'][number]>[] = [
      { key: 'key', header: 'NHÓM', minWidth: 160, render: row => financeDate(financeLabel(row.key)) },
      { key: 'label', header: 'NHÃN', minWidth: 180, render: row => financeDate(financeLabel(row.label)) },
      { key: 'gross', header: 'TỔNG DOANH THU', render: row => money(row.gross) },
      { key: 'refunds', header: 'HOÀN TIỀN', render: row => money(row.refunds) },
      { key: 'net', header: 'DOANH THU RÒNG ƯỚC TÍNH', render: row => money(row.net) },
      { key: 'owner', header: 'THU NHẬP CHỦ SÂN', render: row => money(row.ownerEarnings) },
    ];
    body = <div className="flex flex-col gap-4">
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
  } else {
    const columns: ColumnDef<FinanceAudit>[] = [
      { key: 'time', header: 'THỜI GIAN', minWidth: 160, render: row => dateTime(row.createdAt) },
      { key: 'actor', header: 'NGƯỜI THỰC HIỆN', render: row => `#${row.actorId}` },
      { key: 'action', header: 'HÀNH ĐỘNG', minWidth: 180, render: row => financeLabel(row.action) },
      { key: 'entity', header: 'ĐỐI TƯỢNG', minWidth: 160, render: row => `${financeLabel(row.entityType)}${row.entityId ? `:${row.entityId}` : ''}` },
      { key: 'metadata', header: 'THÔNG TIN BỔ SUNG', minWidth: 280, className: 'max-w-lg whitespace-normal text-xs', render: row => <FinanceValue value={row.metadata} /> },
    ];
    body = <div className="flex flex-col gap-4">
      <FinanceTable data={audits} columns={columns} keyExtractor={row => row.id}
        emptyState={<TableEmpty>Chưa có nhật ký thao tác.</TableEmpty>} />
      {pager(auditMeta, 'bản ghi')}
    </div>;
  }

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
      <ToastContainer toasts={toasts} onRemove={id => setToasts(current => current.filter(toast => toast.id !== id))} />
    </div>
  );
};
