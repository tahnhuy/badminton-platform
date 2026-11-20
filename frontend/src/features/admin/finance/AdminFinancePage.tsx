import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { AdminHeader } from '../components/AdminHeader';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminMain } from '../components/AdminMain';
import { PageHeader } from '@/components/common/page-layout';
import { EmptyState } from '@/components/common/empty-state';
import { DataTable, type ColumnDef } from '@/components/common/data-table';
import { ContentPanel } from '@/components/common/content-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToastContainer, type ToastMessage } from '../components/Toast';
import { ApiError } from '../../../shared/api/http-client';
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
  { key: 'payouts', path: '/admin/finance/payouts', label: 'Payout' },
  { key: 'refunds', path: '/admin/finance/refunds', label: 'Hoàn tiền' },
  { key: 'owner-earnings', path: '/admin/finance/owner-earnings', label: 'Owner earnings' },
  { key: 'reconciliation', path: '/admin/finance/reconciliation', label: 'Đối soát' },
  { key: 'reports', path: '/admin/finance/reports', label: 'Báo cáo' },
  { key: 'audit', path: '/admin/finance/audit', label: 'Audit' },
] as const;

type FinanceSection = (typeof SECTIONS)[number]['key'];
type WalletEntry = FinanceWalletEntry;

const EMPTY_META: FinancePageMeta = { page: 1, limit: 20, total: 0, totalPages: 0 };

function money(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? `${amount.toLocaleString('vi-VN')}đ` : String(value ?? '—');
}

function dateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
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
  return <Badge className={statusTone(value)}>{value}</Badge>;
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
  const [range, setRange] = useState('30d');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [groupBy, setGroupBy] = useState('day');
  const [walletId, setWalletId] = useState('');
  const [page, setPage] = useState(1);
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
    setLoading(true);
    setError('');
    try {
      if (section === 'overview') {
        setOverview(await adminFinanceService.overview({ range }));
      } else if (section === 'transactions') {
        const response = await adminFinanceService.transactions({
          source: sourceFilter || undefined,
          status: statusFilter || undefined,
          page,
          limit: 20,
        });
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
            adminFinanceService.walletEntries(id, { page, limit: 20 }),
          ]);
          setWallet(snapshot);
          setWalletEntries(entries.data);
          setWalletMeta(entries.meta);
        }
      } else if (section === 'top-ups') {
        const response = await adminFinanceService.topUps({ status: statusFilter || undefined, page, limit: 20 });
        setTopUps(response.data);
        setTopUpMeta(response.meta);
      } else if (section === 'payouts') {
        const response = await adminFinanceService.payouts({ status: statusFilter || undefined, page, limit: 20 });
        setPayouts(response.data);
        setPayoutMeta(response.meta);
      } else if (section === 'refunds') {
        const response = await adminFinanceService.refunds({ status: statusFilter || undefined, page, limit: 20 });
        setRefunds(response.data);
        setRefundMeta(response.meta);
      } else if (section === 'owner-earnings') {
        const [history, settlements] = await Promise.all([
          adminFinanceService.ownerEarnings({ page, limit: 20 }),
          adminFinanceService.ownerEarningSettlements({ status: 'PENDING', page, limit: 20 }),
        ]);
        setOwnerEarnings(history.data);
        setOwnerEarningMeta(history.meta);
        setOwnerSettlements(settlements.data);
        setOwnerSettlementMeta(settlements.meta);
      } else if (section === 'reconciliation') {
        setReconciliation(await adminFinanceService.reconciliation({ range }));
      } else if (section === 'reports') {
        setReport(await adminFinanceService.revenue({ range, groupBy }));
      } else if (section === 'audit') {
        const response = await adminFinanceService.audit({ page, limit: 20, action: statusFilter || undefined });
        setAudits(response.data);
        setAuditMeta(response.meta);
      }
    } catch (err) {
      setError(errorMessage(err, 'Không thể tải dữ liệu tài chính.'));
    } finally {
      setLoading(false);
    }
  }, [section, range, statusFilter, sourceFilter, groupBy, page, walletId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); setDetail(null); setStatusFilter(''); setSourceFilter(''); setToasts([]); }, [section]);
  useEffect(() => {
    if (section === 'owner-earnings' && settlementIdParam) setOwnerEarningView('PENDING');
  }, [section, settlementIdParam]);

  const walletAction = async (kind: 'credit' | 'debit') => {
    const id = Number(walletId);
    if (!id) return notify('Nhập User ID trước.');
    const amount = window.prompt(`Số tiền ${kind === 'credit' ? 'cộng' : 'trừ'} (VND)`);
    if (!amount?.trim()) return;
    const reason = window.prompt('Lý do (bắt buộc)');
    if (!reason?.trim()) return;
    try {
      if (kind === 'credit') await adminFinanceService.creditWallet(id, { amount: amount.trim(), reason: reason.trim() });
      else await adminFinanceService.debitWallet(id, { amount: amount.trim(), reason: reason.trim() });
      notify(kind === 'credit' ? 'Đã cộng ví.' : 'Đã trừ ví.');
      await load();
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
      notify(`Đã cập nhật payout #${payout.id}.`);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Không thể cập nhật payout.'));
    }
  };

  const manualMatch = async () => {
    const provider = window.prompt('Provider (SEPAY/MOCK/VNPAY)');
    if (!provider?.trim()) return;
    const providerReference = window.prompt('Mã giao dịch ngân hàng (provider reference)');
    if (!providerReference?.trim()) return;
    const amount = window.prompt('Số tiền (VND)');
    if (!amount?.trim()) return;
    const userId = window.prompt('User ID nhận tiền');
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
      notify('Đã ghép top-up.');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Không thể ghép top-up.'));
    }
  };

  const retryRefund = async (refund: FinanceRefund) => {
    try {
      await adminFinanceService.retryRefund(refund.paymentId);
      notify(`Đã retry refund #${refund.paymentId}.`);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Không thể retry refund.'));
    }
  };

  const resolveRefund = async (refund: FinanceRefund) => {
    const note = window.prompt('Ghi chú xử lý (bắt buộc)');
    if (!note?.trim()) return;
    try {
      await adminFinanceService.resolveRefund(refund.paymentId, note.trim());
      notify('Đã ghi chú xử lý refund.');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Không thể ghi chú refund.'));
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
      notify(`Owner earnings: scanned ${result.scanned}, credited ${result.credited}, pending ${result.pending}, skipped ${result.skipped}, failed ${result.failed}.`);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Không thể chạy owner earnings.'));
    }
  };

  const ownerSettlementAction = async (settlement: FinanceOwnerEarningSettlement, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        const note = window.prompt('Ghi chú duyệt (không bắt buộc)');
        if (note === null) return;
        await adminFinanceService.approveOwnerEarningSettlement(settlement.id, note.trim() || undefined);
        notify(`Đã duyệt và cộng ví Owner cho settlement #${settlement.id}.`);
      } else {
        const reason = window.prompt('Lý do từ chối (bắt buộc)');
        if (!reason?.trim()) return;
        await adminFinanceService.rejectOwnerEarningSettlement(settlement.id, reason.trim());
        notify(`Đã từ chối settlement #${settlement.id}.`);
      }
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Không thể xử lý Owner earning.'));
    }
  };

  const resolveDiscrepancy = async (key: string) => {
    const note = window.prompt('Ghi chú xử lý lệch (bắt buộc)');
    if (!note?.trim()) return;
    try {
      await adminFinanceService.resolveReconciliation(key, note.trim());
      notify('Đã ghi nhận xử lý lệch.');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Không thể xử lý lệch.'));
    }
  };

  const exportData = async (type: FinanceExportType) => {
    try {
      await adminFinanceService.downloadExport(type, {
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

  const pager = (meta: FinancePageMeta) => (
    meta.totalPages > 1 ? (
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <Button type="button" variant="outline" className="h-9 px-3" disabled={meta.page <= 1}
          onClick={() => setPage(current => Math.max(1, current - 1))}>Trước</Button>
        <span className="text-muted-foreground">Trang {meta.page}/{meta.totalPages} · {meta.total} dòng</span>
        <Button type="button" variant="outline" className="h-9 px-3" disabled={meta.page >= meta.totalPages}
          onClick={() => setPage(current => current + 1)}>Sau</Button>
      </div>
    ) : null
  );

  const filterBar = (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <FilterControl label="Khoảng thời gian">
        <NativeSelect value={range} aria-label="Khoảng thời gian"
          onChange={event => { setRange(event.target.value); setPage(1); }} className="h-10 w-40">
          <option value="today">Hôm nay</option>
          <option value="7d">7 ngày</option>
          <option value="30d">30 ngày</option>
          <option value="this_month">Tháng này</option>
        </NativeSelect>
      </FilterControl>

      {(section === 'transactions' || section === 'audit') && (
        <FilterControl label="Trạng thái / hành động">
          <NativeSelect value={statusFilter} aria-label="Lọc theo trạng thái hoặc hành động"
            onChange={event => { setStatusFilter(event.target.value); setPage(1); }} className="h-10 w-48">
            <option value="">Tất cả trạng thái/action</option>
            {section === 'transactions' ? (
              <>
                {['PENDING', 'SUCCESS', 'FAILED', 'PAID', 'REFUNDED', 'POSTED'].map(value => <option key={value} value={value}>{value}</option>)}
              </>
            ) : (
              <>
                {['EXPORT', 'WALLET_CREDIT', 'WALLET_DEBIT', 'PAYOUT_APPROVE', 'PAYOUT_REJECT', 'PAYOUT_MARK_PAID', 'REFUND_RETRY', 'REFUND_RESOLVE', 'OWNER_EARNING_SWEEP', 'RECONCILIATION_RESOLVE'].map(value => <option key={value} value={value}>{value}</option>)}
              </>
            )}
          </NativeSelect>
        </FilterControl>
      )}

      {section === 'transactions' && (
        <FilterControl label="Nguồn">
          <NativeSelect value={sourceFilter} aria-label="Lọc theo nguồn"
            onChange={event => { setSourceFilter(event.target.value); setPage(1); }} className="h-10 w-40">
            <option value="">Tất cả nguồn</option>
            <option value="ledger">Ledger</option>
            <option value="top-up">Top-up</option>
            <option value="payout">Payout</option>
            <option value="refund">Refund</option>
          </NativeSelect>
        </FilterControl>
      )}

      {['top-ups', 'payouts', 'refunds'].includes(section) && (
        <FilterControl label="Trạng thái">
          <NativeSelect value={statusFilter} aria-label="Lọc theo trạng thái"
            onChange={event => { setStatusFilter(event.target.value); setPage(1); }} className="h-10 w-40">
            <option value="">Tất cả trạng thái</option>
            {section === 'top-ups' && ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'].map(value => <option key={value} value={value}>{value}</option>)}
            {section === 'payouts' && ['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'FAILED'].map(value => <option key={value} value={value}>{value}</option>)}
            {section === 'refunds' && ['PENDING', 'PROCESSING', 'REFUNDED', 'FAILED'].map(value => <option key={value} value={value}>{value}</option>)}
          </NativeSelect>
        </FilterControl>
      )}

      {section === 'reports' && (
        <FilterControl label="Nhóm báo cáo">
          <NativeSelect value={groupBy} aria-label="Nhóm báo cáo"
            onChange={event => { setGroupBy(event.target.value); setPage(1); }} className="h-10 w-40">
            <option value="day">Theo ngày</option>
            <option value="source">Theo nguồn</option>
            <option value="owner">Theo Owner</option>
          </NativeSelect>
        </FilterControl>
      )}

      <Button type="button" variant="outline" className="h-10" onClick={() => void load()}>
        <RefreshCw aria-hidden="true" />
        Làm mới
      </Button>
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
    body = overview ? (
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <KpiCard label="Tổng số dư ví" value={money(overview.walletLiability)} />
          <KpiCard label="Đang giữ (held)" value={money(overview.held)} />
          <KpiCard label="Khả dụng" value={money(overview.available)} />
          <KpiCard label="Cash in" value={money(overview.cashIn)} />
          <KpiCard label="Cash out" value={money(overview.cashOut)} />
          <KpiCard label="Doanh thu gross" value={money(overview.grossRevenue)} />
          <KpiCard label="Hoàn tiền" value={money(overview.refunds)} />
          <KpiCard label="Net ước tính" value={money(overview.netEstimated)} />
          <KpiCard label="Owner earnings" value={money(overview.ownerEarnings)} />
          <KpiCard label="Payout chờ duyệt" value={overview.pendingPayouts.count} sub={money(overview.pendingPayouts.amount)} />
          <KpiCard label="Owner earnings chờ duyệt" value={overview.pendingOwnerEarnings?.count ?? 0} sub={money(overview.pendingOwnerEarnings?.amount)} />
          <KpiCard label="Refund lỗi" value={overview.failedRefunds.count} sub={money(overview.failedRefunds.amount)} />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold tracking-tight">Xu hướng theo ngày</h2>
          <DataTable
            data={overview.trend.cashIn.slice(-14).map(row => ({
              day: row.day,
              cashIn: row.amount,
              cashOut: overview.trend.cashOut.find(item => item.day === row.day)?.amount,
              revenue: overview.trend.revenue.find(item => item.day === row.day)?.amount,
            }))}
            columns={[
              { key: 'day', header: 'NGÀY', render: row => row.day },
              { key: 'cashIn', header: 'CASH IN', render: row => money(row.cashIn) },
              { key: 'cashOut', header: 'CASH OUT', render: row => money(row.cashOut) },
              { key: 'revenue', header: 'REVENUE', render: row => money(row.revenue) },
            ]}
            keyExtractor={row => row.day}
            emptyState={<TableEmpty>Không có dữ liệu xu hướng.</TableEmpty>}
          />
        </div>

        <div>
          <Button type="button" variant="outline" onClick={() => void exportData('transactions')}>Xuất giao dịch Excel</Button>
        </div>
      </div>
    ) : <TableEmpty>Không có dữ liệu.</TableEmpty>;
  } else if (section === 'transactions') {
    const columns: ColumnDef<FinanceTransaction>[] = [
      { key: 'time', header: 'THỜI GIAN', minWidth: 160, render: row => dateTime(row.occurredAt) },
      { key: 'source', header: 'NGUỒN', render: row => row.source },
      { key: 'type', header: 'LOẠI', render: row => row.type },
      { key: 'status', header: 'TRẠNG THÁI', render: row => <StatusBadge value={row.status} /> },
      { key: 'user', header: 'USER', render: row => `#${row.userId}` },
      { key: 'amount', header: 'SỐ TIỀN', render: row => <strong>{money(row.amount)}</strong> },
      { key: 'ref', header: 'THAM CHIẾU', render: row => row.referenceType ? `${row.referenceType}:${row.referenceId ?? ''}` : '—' },
      { key: 'desc', header: 'DIỄN GIẢI', minWidth: 220, className: 'max-w-xs whitespace-normal', render: row => row.description || '—' },
      {
        key: 'action', header: '', render: row => <Button type="button" variant="outline" className="h-9 px-3"
          onClick={async () => setDetail(await adminFinanceService.transactionDetail(row.source, row.sourceId))}>Chi tiết</Button>,
      },
    ];
    body = <div className="flex flex-col gap-4">
      {filterBar}
      <div>
        <Button type="button" variant="outline" onClick={() => void exportData('transactions')}>Xuất Excel</Button>
      </div>
      <DataTable data={transactions} columns={columns} keyExtractor={row => `${row.source}:${row.sourceId}`}
        emptyState={<TableEmpty>Không có giao dịch.</TableEmpty>} />
      {pager(transactionMeta)}
      {detail !== null && <ContentPanel title="Chi tiết giao dịch">
        <div className="flex justify-end">
          <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => setDetail(null)}>Đóng</Button>
        </div>
        <pre className="max-h-80 overflow-auto rounded-lg bg-muted/40 p-3 text-xs whitespace-pre-wrap">{JSON.stringify(detail, null, 2)}</pre>
      </ContentPanel>}
    </div>;
  } else if (section === 'wallets') {
    const columns: ColumnDef<WalletEntry>[] = [
      { key: 'time', header: 'THỜI GIAN', minWidth: 160, render: entry => dateTime(entry.createdAt) },
      { key: 'type', header: 'LOẠI', render: entry => entry.entryType },
      { key: 'amount', header: 'SỐ TIỀN', render: entry => <strong>{money(entry.amount)}</strong> },
      { key: 'balance', header: 'SỐ DƯ SAU', render: entry => money(entry.balanceAfter) },
      { key: 'ref', header: 'THAM CHIẾU', render: entry => entry.referenceType ? `${entry.referenceType}:${entry.referenceId ?? ''}` : '—' },
      { key: 'desc', header: 'DIỄN GIẢI', minWidth: 200, render: entry => entry.description || '—' },
      { key: 'actor', header: 'ACTOR', render: entry => entry.createdBy ?? '—' },
    ];
    body = <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <FilterControl label="User ID">
          <Input value={walletId} onChange={event => setWalletId(event.target.value)} placeholder="User ID" className="h-10 w-40" />
        </FilterControl>
        <Button type="button" variant="outline" className="h-10" onClick={() => void load()}>Xem ví</Button>
        <Button type="button" variant="outline" className="h-10" onClick={() => void walletAction('credit')}>Cộng ví</Button>
        <Button type="button" variant="outline" className="h-10" onClick={() => void walletAction('debit')}>Trừ ví</Button>
      </div>
      {!wallet ? <TableEmpty>Nhập User ID để xem ví.</TableEmpty> : <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="User" value={`#${wallet.user.id}`} sub={wallet.user.email} />
          <KpiCard label="Balance" value={money(wallet.balance)} />
          <KpiCard label="Held" value={money(wallet.held)} />
          <KpiCard label="Available" value={money(wallet.available)} />
        </div>
        <DataTable data={walletEntries} columns={columns} keyExtractor={entry => entry.id}
          emptyState={<TableEmpty>Chưa có bút toán.</TableEmpty>} />
        {pager(walletMeta)}
      </div>}
    </div>;
  } else if (section === 'top-ups') {
    const columns: ColumnDef<FinanceTopUp>[] = [
      { key: 'id', header: 'MÃ', render: row => `#${row.id}` },
      { key: 'user', header: 'USER', render: row => `#${row.userId}` },
      { key: 'amount', header: 'SỐ TIỀN', render: row => <strong>{money(row.amount)}</strong> },
      { key: 'status', header: 'TRẠNG THÁI', render: row => <StatusBadge value={row.status} /> },
      { key: 'provider', header: 'PROVIDER', render: row => row.provider },
      { key: 'ref', header: 'TXN REF', render: row => row.txnRef },
      { key: 'created', header: 'TẠO LÚC', minWidth: 160, render: row => dateTime(row.createdAt) },
      { key: 'paid', header: 'ĐÃ TRẢ', minWidth: 160, render: row => dateTime(row.paidAt) },
    ];
    body = <div className="flex flex-col gap-4">
      {filterBar}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void manualMatch()}>Ghép tay top-up</Button>
        <Button type="button" variant="outline" onClick={() => void exportData('top-ups')}>Xuất Excel</Button>
      </div>
      <DataTable data={topUps} columns={columns} keyExtractor={row => row.id}
        emptyState={<TableEmpty>Không có top-up.</TableEmpty>} />
      {pager(topUpMeta)}
    </div>;
  } else if (section === 'payouts') {
    const columns: ColumnDef<FinancePayout>[] = [
      { key: 'id', header: 'MÃ', render: row => `#${row.id}` },
      { key: 'user', header: 'USER', render: row => `#${row.userId}` },
      { key: 'type', header: 'LOẠI', render: row => row.requestType },
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
      {filterBar}
      <div>
        <Button type="button" variant="outline" onClick={() => void exportData('payouts')}>Xuất Excel</Button>
      </div>
      <DataTable data={payouts} columns={columns} keyExtractor={row => row.id}
        rowClassName={row => row.id === payoutIdParam ? 'bg-accent/40' : undefined}
        emptyState={<TableEmpty>Không có payout.</TableEmpty>} />
      {pager(payoutMeta)}
    </div>;
  } else if (section === 'refunds') {
    const columns: ColumnDef<FinanceRefund>[] = [
      { key: 'payment', header: 'PAYMENT', render: row => `#${row.paymentId}` },
      { key: 'booking', header: 'BOOKING', render: row => row.bookingId ? `#${row.bookingId}` : '—' },
      { key: 'user', header: 'USER', render: row => row.userId ? `#${row.userId}` : '—' },
      { key: 'amount', header: 'SỐ TIỀN', render: row => <strong>{money(row.amount)}</strong> },
      { key: 'status', header: 'TRẠNG THÁI', render: row => <StatusBadge value={row.status} /> },
      { key: 'attempts', header: 'LẦN THỬ', render: row => row.attempts },
      { key: 'error', header: 'LỖI GẦN NHẤT', minWidth: 220, className: 'max-w-xs whitespace-normal', render: row => row.lastError || '—' },
      { key: 'updated', header: 'CẬP NHẬT', minWidth: 160, render: row => dateTime(row.updatedAt) },
      {
        key: 'actions', header: 'THAO TÁC', minWidth: 180, render: row => <div className="flex flex-wrap gap-2">
          {row.status === 'FAILED' && <Button type="button" variant="outline" className="h-9 px-3" onClick={() => void retryRefund(row)}>Retry</Button>}
          <Button type="button" variant="outline" className="h-9 px-3" onClick={() => void resolveRefund(row)}>Ghi chú</Button>
        </div>,
      },
    ];
    body = <div className="flex flex-col gap-4">
      {filterBar}
      <div>
        <Button type="button" variant="outline" onClick={() => void exportData('refunds')}>Xuất Excel</Button>
      </div>
      <DataTable data={refunds} columns={columns} keyExtractor={row => row.paymentId}
        rowClassName={row => row.paymentId === paymentIdParam ? 'bg-accent/40' : undefined}
        emptyState={<TableEmpty>Không có refund.</TableEmpty>} />
      {pager(refundMeta)}
    </div>;
  } else if (section === 'owner-earnings') {
    const pendingSettlements = ownerSettlements.filter(row => row.status === 'PENDING');
    const settlementColumns: ColumnDef<FinanceOwnerEarningSettlement>[] = [
      { key: 'id', header: 'MÃ', render: row => `#${row.id}` },
      { key: 'booking', header: 'BOOKING', minWidth: 180, render: row => row.bookingCode ? `${row.bookingCode} · #${row.bookingId}` : `#${row.bookingId}` },
      { key: 'owner', header: 'OWNER', minWidth: 190, render: row => `#${row.ownerId} · ${row.ownerEmail}` },
      { key: 'amount', header: 'SỐ TIỀN', render: row => <strong>{money(row.amount)}</strong> },
      { key: 'status', header: 'TRẠNG THÁI', render: row => <StatusBadge value={row.status} /> },
      { key: 'mode', header: 'MODE', render: row => row.mode },
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
      { key: 'owner', header: 'OWNER', minWidth: 190, render: row => `#${row.ownerId} · ${row.ownerEmail}` },
      { key: 'booking', header: 'BOOKING', minWidth: 160, render: row => row.bookingId ? `#${row.bookingId}${row.bookingCode ? ` · ${row.bookingCode}` : ''}` : '—' },
      { key: 'type', header: 'LOẠI', render: row => row.entryType },
      { key: 'amount', header: 'SỐ TIỀN', render: row => <strong>{money(row.amount)}</strong> },
      { key: 'balance', header: 'SỐ DƯ SAU', render: row => money(row.balanceAfter) },
      { key: 'desc', header: 'DIỄN GIẢI', minWidth: 200, render: row => row.description || '—' },
      { key: 'time', header: 'THỜI GIAN', minWidth: 160, render: row => dateTime(row.createdAt) },
    ];
    body = <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
        Khi cấu hình “Tự động cộng ví chủ sân” đang tắt, booking hoàn tất sẽ nằm ở tab Chờ duyệt.
        Admin duyệt thì hệ thống cộng ví Owner; từ chối thì không cộng.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void runOwnerSweep(true)}>Dry-run sweep</Button>
        <Button type="button" variant="outline" onClick={() => void runOwnerSweep(false)}>Chạy sweep</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={ownerEarningView === 'PENDING' ? 'brand' : 'outline'} className="h-9 px-3"
          onClick={() => setOwnerEarningView('PENDING')}>Chờ duyệt ({pendingSettlements.length})</Button>
        <Button type="button" variant={ownerEarningView === 'LEDGER' ? 'brand' : 'outline'} className="h-9 px-3"
          onClick={() => setOwnerEarningView('LEDGER')}>Đã cộng</Button>
      </div>
      {ownerEarningView === 'PENDING' ? <div className="flex flex-col gap-4">
        <DataTable data={ownerSettlements} columns={settlementColumns} keyExtractor={row => row.id}
          rowClassName={row => row.id === settlementIdParam ? 'bg-accent/40' : undefined}
          emptyState={<TableEmpty>Chưa có settlement.</TableEmpty>} />
        {pager(ownerSettlementMeta)}
      </div> : <div className="flex flex-col gap-4">
        <DataTable data={ownerEarnings} columns={earningColumns} keyExtractor={row => row.id}
          emptyState={<TableEmpty>Chưa có owner earning.</TableEmpty>} />
        {pager(ownerEarningMeta)}
      </div>}
    </div>;
  } else if (section === 'reconciliation') {
    const columns: ColumnDef<FinanceReconciliation['discrepancies'][number]>[] = [
      { key: 'key', header: 'KEY', minWidth: 180, render: row => row.key },
      { key: 'type', header: 'LOẠI', render: row => row.type },
      { key: 'entity', header: 'ENTITY', minWidth: 160, render: row => `${row.entityType}${row.entityId ? `:${row.entityId}` : ''}` },
      { key: 'expected', header: 'EXPECTED', render: row => row.expected },
      { key: 'actual', header: 'ACTUAL', render: row => row.actual },
      { key: 'delta', header: 'DELTA', render: row => row.delta },
      { key: 'message', header: 'THÔNG ĐIỆP', minWidth: 240, className: 'max-w-sm whitespace-normal', render: row => row.message },
      {
        key: 'actions', header: '', render: row => <Button type="button" variant="outline" className="h-9 px-3"
          onClick={() => void resolveDiscrepancy(row.key)}>Resolve</Button>,
      },
    ];
    body = <div className="flex flex-col gap-4">
      {filterBar}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void load()}>Chạy đối soát</Button>
        <Button type="button" variant="outline" onClick={() => void exportData('reconciliation')}>Xuất Excel</Button>
      </div>
      {!reconciliation ? <TableEmpty>Chưa chạy đối soát.</TableEmpty> : <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard label="Checks" value={reconciliation.summary.checks} />
          <KpiCard label="Lệch" value={reconciliation.summary.failed} />
          <KpiCard label="Truncated" value={reconciliation.summary.truncated ? 'Có' : 'Không'} />
        </div>
        <DataTable data={reconciliation.discrepancies} columns={columns} keyExtractor={row => row.key}
          emptyState={<TableEmpty>Không phát hiện lệch.</TableEmpty>} />
      </div>}
    </div>;
  } else if (section === 'reports') {
    const columns: ColumnDef<FinanceReport['rows'][number]>[] = [
      { key: 'key', header: 'NHÓM', minWidth: 160, render: row => row.key },
      { key: 'label', header: 'NHÃN', minWidth: 180, render: row => row.label },
      { key: 'gross', header: 'GROSS', render: row => money(row.gross) },
      { key: 'refunds', header: 'REFUNDS', render: row => money(row.refunds) },
      { key: 'net', header: 'NET ƯỚC TÍNH', render: row => money(row.net) },
      { key: 'owner', header: 'OWNER EARNINGS', render: row => money(row.ownerEarnings) },
    ];
    body = <div className="flex flex-col gap-4">
      {filterBar}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void exportData('revenue')}>Xuất revenue</Button>
        <Button type="button" variant="outline" onClick={() => void exportData('cash-flow')}>Xuất cash-flow</Button>
      </div>
      {!report ? <TableEmpty>Không có báo cáo.</TableEmpty> : <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard label="Gross" value={money(report.totals.grossRevenue)} />
          <KpiCard label="Refunds" value={money(report.totals.refunds)} />
          <KpiCard label="Net ước tính" value={money(report.totals.netEstimated)} />
          <KpiCard label="Owner earnings" value={money(report.totals.ownerEarnings)} />
          <KpiCard label="Cash in" value={money(report.totals.cashIn)} />
          <KpiCard label="Cash out" value={money(report.totals.cashOut)} />
        </div>
        <DataTable data={report.rows} columns={columns} keyExtractor={row => row.key}
          emptyState={<TableEmpty>Không có dữ liệu trong kỳ.</TableEmpty>} />
        <p className="text-xs text-muted-foreground">Revenue là số ước tính vận hành, không phải số kế toán/quyết toán.</p>
      </div>}
    </div>;
  } else {
    const columns: ColumnDef<FinanceAudit>[] = [
      { key: 'time', header: 'THỜI GIAN', minWidth: 160, render: row => dateTime(row.createdAt) },
      { key: 'actor', header: 'ACTOR', render: row => `#${row.actorId}` },
      { key: 'action', header: 'ACTION', minWidth: 180, render: row => row.action },
      { key: 'entity', header: 'ENTITY', minWidth: 160, render: row => `${row.entityType}${row.entityId ? `:${row.entityId}` : ''}` },
      { key: 'metadata', header: 'METADATA', minWidth: 280, className: 'max-w-lg whitespace-normal text-xs', render: row => JSON.stringify(row.metadata) },
    ];
    body = <div className="flex flex-col gap-4">
      {filterBar}
      <DataTable data={audits} columns={columns} keyExtractor={row => row.id}
        emptyState={<TableEmpty>Chưa có audit.</TableEmpty>} />
      {pager(auditMeta)}
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
            description="Vận hành ví, nạp tiền, payout, hoàn tiền, owner earnings, đối soát và báo cáo."
          />
          <nav aria-label="Mục quản lý tài chính" className="flex flex-wrap gap-2">
            {SECTIONS.map(item => (
              <Button key={item.key} asChild variant={item.key === activeSection.key ? 'brand' : 'outline'} className="h-9 px-3">
                <Link to={item.path} aria-current={item.key === activeSection.key ? 'page' : undefined}>{item.label}</Link>
              </Button>
            ))}
          </nav>
          {body}
        </main>
      </AdminMain>
      <ToastContainer toasts={toasts} onRemove={id => setToasts(current => current.filter(toast => toast.id !== id))} />
    </div>
  );
};
