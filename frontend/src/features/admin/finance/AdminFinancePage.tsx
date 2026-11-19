import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AdminHeader } from '../components/AdminHeader';
import { AdminSidebar } from '../components/AdminSidebar';
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

function cardStyle(): React.CSSProperties {
  return { background: '#fff', border: '1px solid rgba(189,202,186,0.45)', borderRadius: 12, padding: 16 };
}

function tableWrap(children: React.ReactNode) {
  return <div className="admin-table-container">{children}</div>;
}

function statusPill(value: string) {
  const failed = ['FAILED', 'REJECTED', 'EXPIRED'].includes(value);
  const done = ['PAID', 'SUCCESS', 'REFUNDED', 'POSTED'].includes(value);
  return (
    <span style={{
      display: 'inline-flex', padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
      background: failed ? '#FDE7E7' : done ? '#E3F4E8' : '#FFF3D8',
      color: failed ? '#A11A1A' : done ? '#0B6B2E' : '#7A4A00',
    }}>{value}</span>
  );
}

function uiRedoNote() {
  return (
    <p style={{ fontSize: 12, color: '#7A4A00', background: '#FFF3D8', border: '1px solid #F0D79A', borderRadius: 8, padding: '6px 10px' }}>
      UI-REDO: giao diện base đủ để test luồng/nghiệp vụ; visual sẽ được làm lại sau.
    </p>
  );
}

export const AdminFinancePage: React.FC = () => {
  const params = useParams<{ section?: string }>();
  const [searchParams] = useSearchParams();
  const section = (SECTIONS.some(item => item.key === params.section) ? params.section : 'overview') as FinanceSection;

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
  const [toast, setToast] = useState('');

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

  const activeSection = useMemo(() => SECTIONS.find(item => item.key === section)!, [section]);
  const payoutIdParam = Number(searchParams.get('payoutId'));
  const paymentIdParam = Number(searchParams.get('paymentId'));
  const settlementIdParam = Number(searchParams.get('settlementId'));

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 4000);
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
  useEffect(() => { setPage(1); setDetail(null); setToast(''); setStatusFilter(''); setSourceFilter(''); }, [section]);
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

  const pagination = (meta: FinancePageMeta) => (
    meta.totalPages > 1 ? (
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
        <button type="button" className="social-button" disabled={meta.page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Trước</button>
        <span style={{ alignSelf: 'center', fontSize: 13 }}>Trang {meta.page}/{meta.totalPages} · {meta.total} dòng</span>
        <button type="button" className="social-button" disabled={meta.page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>Sau</button>
      </div>
    ) : null
  );

  const filterBar = (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      <select value={range} onChange={event => { setRange(event.target.value); setPage(1); }} style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(189,202,186,0.6)' }}>
        <option value="today">Hôm nay</option>
        <option value="7d">7 ngày</option>
        <option value="30d">30 ngày</option>
        <option value="this_month">Tháng này</option>
      </select>
      {(section === 'transactions' || section === 'audit') && (
        <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }} style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(189,202,186,0.6)' }}>
          <option value="">Tất cả trạng thái/action</option>
          {section === 'transactions' ? (
            <>
              <option value="PENDING">PENDING</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
              <option value="PAID">PAID</option>
              <option value="REFUNDED">REFUNDED</option>
              <option value="POSTED">POSTED</option>
            </>
          ) : (
            <>
              <option value="EXPORT">EXPORT</option>
              <option value="WALLET_CREDIT">WALLET_CREDIT</option>
              <option value="WALLET_DEBIT">WALLET_DEBIT</option>
              <option value="PAYOUT_APPROVE">PAYOUT_APPROVE</option>
              <option value="PAYOUT_REJECT">PAYOUT_REJECT</option>
              <option value="PAYOUT_MARK_PAID">PAYOUT_MARK_PAID</option>
              <option value="REFUND_RETRY">REFUND_RETRY</option>
              <option value="REFUND_RESOLVE">REFUND_RESOLVE</option>
              <option value="OWNER_EARNING_SWEEP">OWNER_EARNING_SWEEP</option>
              <option value="RECONCILIATION_RESOLVE">RECONCILIATION_RESOLVE</option>
            </>
          )}
        </select>
      )}
      {section === 'transactions' && (
        <select value={sourceFilter} onChange={event => { setSourceFilter(event.target.value); setPage(1); }} style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(189,202,186,0.6)' }}>
          <option value="">Tất cả nguồn</option>
          <option value="ledger">Ledger</option>
          <option value="top-up">Top-up</option>
          <option value="payout">Payout</option>
          <option value="refund">Refund</option>
        </select>
      )}
      {['top-ups', 'payouts', 'refunds'].includes(section) && (
        <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }} style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(189,202,186,0.6)' }}>
          <option value="">Tất cả trạng thái</option>
          {section === 'top-ups' && ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'].map(value => <option key={value} value={value}>{value}</option>)}
          {section === 'payouts' && ['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'FAILED'].map(value => <option key={value} value={value}>{value}</option>)}
          {section === 'refunds' && ['PENDING', 'PROCESSING', 'REFUNDED', 'FAILED'].map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      )}
      {section === 'reports' && (
        <select value={groupBy} onChange={event => { setGroupBy(event.target.value); setPage(1); }} style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(189,202,186,0.6)' }}>
          <option value="day">Theo ngày</option>
          <option value="source">Theo nguồn</option>
          <option value="owner">Theo Owner</option>
        </select>
      )}
      <button type="button" className="social-button" onClick={() => void load()}>Làm mới</button>
    </div>
  );

  const body = useMemo(() => {
    if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Đang tải dữ liệu…</p>;
    if (error) return <p role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>;

    if (section === 'overview') {
      if (!overview) return <p>Không có dữ liệu.</p>;
      const cards = [
        ['Tổng số dư ví', overview.walletLiability],
        ['Đang giữ (held)', overview.held],
        ['Khả dụng', overview.available],
        ['Cash in', overview.cashIn],
        ['Cash out', overview.cashOut],
        ['Doanh thu gross', overview.grossRevenue],
        ['Hoàn tiền', overview.refunds],
        ['Net ước tính', overview.netEstimated],
        ['Owner earnings', overview.ownerEarnings],
      ];
      return (
        <>
          {uiRedoNote()}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {cards.map(([label, value]) => (
              <div key={label} style={cardStyle()}>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{money(value)}</div>
              </div>
            ))}
            <div style={cardStyle()}>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Payout chờ duyệt</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{overview.pendingPayouts.count}</div>
              <div style={{ fontSize: 12 }}>{money(overview.pendingPayouts.amount)}</div>
            </div>
            <div style={cardStyle()}>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Owner earnings chờ duyệt</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{overview.pendingOwnerEarnings?.count ?? 0}</div>
              <div style={{ fontSize: 12 }}>{money(overview.pendingOwnerEarnings?.amount)}</div>
            </div>
            <div style={cardStyle()}>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Refund lỗi</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{overview.failedRefunds.count}</div>
              <div style={{ fontSize: 12 }}>{money(overview.failedRefunds.amount)}</div>
            </div>
          </div>
          <div style={{ ...cardStyle(), marginTop: 16 }}>
            <strong>Xu hướng theo ngày (base table)</strong>
            {tableWrap(
              <table className="admin-table">
                <thead><tr><th>Ngày</th><th>Cash in</th><th>Cash out</th><th>Revenue</th></tr></thead>
                <tbody>
                  {overview.trend.cashIn.slice(-14).map(row => (
                    <tr key={row.day}>
                      <td>{row.day}</td>
                      <td>{money(row.amount)}</td>
                      <td>{money(overview.trend.cashOut.find(item => item.day === row.day)?.amount)}</td>
                      <td>{money(overview.trend.revenue.find(item => item.day === row.day)?.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>,
            )}
          </div>
          <button type="button" className="social-button" style={{ marginTop: 12 }} onClick={() => void exportData('transactions')}>Xuất giao dịch Excel</button>
        </>
      );
    }

    if (section === 'transactions') {
      return (
        <>
          {uiRedoNote()}
          {filterBar}
          <button type="button" className="social-button" style={{ marginBottom: 12 }} onClick={() => void exportData('transactions')}>Xuất Excel</button>
          {tableWrap(
            <table className="admin-table">
              <thead><tr><th>Thời gian</th><th>Nguồn</th><th>Loại</th><th>Trạng thái</th><th>User</th><th>Số tiền</th><th>Tham chiếu</th><th>Diễn giải</th><th /></tr></thead>
              <tbody>
                {transactions.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 28 }}>Không có giao dịch.</td></tr>}
                {transactions.map(row => (
                  <tr key={`${row.source}:${row.sourceId}`}>
                    <td>{dateTime(row.occurredAt)}</td>
                    <td>{row.source}</td>
                    <td>{row.type}</td>
                    <td>{statusPill(row.status)}</td>
                    <td>#{row.userId}</td>
                    <td><strong>{money(row.amount)}</strong></td>
                    <td>{row.referenceType ? `${row.referenceType}:${row.referenceId ?? ''}` : '—'}</td>
                    <td style={{ maxWidth: 280, whiteSpace: 'normal' }}>{row.description || '—'}</td>
                    <td><button type="button" className="social-button" onClick={async () => setDetail(await adminFinanceService.transactionDetail(row.source, row.sourceId))}>Chi tiết</button></td>
                  </tr>
                ))}
              </tbody>
            </table>,
          )}
          {pagination(transactionMeta)}
          {detail !== null && (
            <div style={{ ...cardStyle(), marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>Chi tiết giao dịch</strong>
                <button type="button" className="social-button" onClick={() => setDetail(null)}>Đóng</button>
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 320, overflow: 'auto' }}>{JSON.stringify(detail, null, 2)}</pre>
            </div>
          )}
        </>
      );
    }

    if (section === 'wallets') {
      return (
        <>
          {uiRedoNote()}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input value={walletId} onChange={event => setWalletId(event.target.value)} placeholder="User ID" style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(189,202,186,0.6)', width: 160 }} />
            <button type="button" className="social-button" onClick={() => void load()}>Xem ví</button>
            <button type="button" className="social-button" onClick={() => void walletAction('credit')}>Cộng ví</button>
            <button type="button" className="social-button" onClick={() => void walletAction('debit')}>Trừ ví</button>
          </div>
          {!wallet && <p>Nhập User ID để xem ví.</p>}
          {wallet && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div style={cardStyle()}><div style={{ fontSize: 12 }}>User</div><strong>#{wallet.user.id} · {wallet.user.email}</strong></div>
                <div style={cardStyle()}><div style={{ fontSize: 12 }}>Balance</div><strong>{money(wallet.balance)}</strong></div>
                <div style={cardStyle()}><div style={{ fontSize: 12 }}>Held</div><strong>{money(wallet.held)}</strong></div>
                <div style={cardStyle()}><div style={{ fontSize: 12 }}>Available</div><strong>{money(wallet.available)}</strong></div>
              </div>
              <div style={{ marginTop: 16 }}>
                {tableWrap(
                  <table className="admin-table">
                    <thead><tr><th>Thời gian</th><th>Loại</th><th>Số tiền</th><th>Số dư sau</th><th>Tham chiếu</th><th>Diễn giải</th><th>Actor</th></tr></thead>
                    <tbody>
                      {walletEntries.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28 }}>Chưa có bút toán.</td></tr>}
                      {walletEntries.map(entry => (
                        <tr key={entry.id}>
                          <td>{dateTime(entry.createdAt)}</td>
                          <td>{entry.entryType}</td>
                          <td><strong>{money(entry.amount)}</strong></td>
                          <td>{money(entry.balanceAfter)}</td>
                          <td>{entry.referenceType ? `${entry.referenceType}:${entry.referenceId ?? ''}` : '—'}</td>
                          <td>{entry.description || '—'}</td>
                          <td>{entry.createdBy ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>,
                )}
                {pagination(walletMeta)}
              </div>
            </>
          )}
        </>
      );
    }

    if (section === 'top-ups') {
      return (
        <>
          {uiRedoNote()}
          {filterBar}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <button type="button" className="social-button" onClick={() => void manualMatch()}>Ghép tay top-up</button>
            <button type="button" className="social-button" onClick={() => void exportData('top-ups')}>Xuất Excel</button>
          </div>
          {tableWrap(
            <table className="admin-table">
              <thead><tr><th>Mã</th><th>User</th><th>Số tiền</th><th>Trạng thái</th><th>Provider</th><th>Txn ref</th><th>Tạo lúc</th><th>Đã trả</th></tr></thead>
              <tbody>
                {topUps.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28 }}>Không có top-up.</td></tr>}
                {topUps.map(row => (
                  <tr key={row.id}>
                    <td>#{row.id}</td><td>#{row.userId}</td><td><strong>{money(row.amount)}</strong></td>
                    <td>{statusPill(row.status)}</td><td>{row.provider}</td><td>{row.txnRef}</td>
                    <td>{dateTime(row.createdAt)}</td><td>{dateTime(row.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>,
          )}
          {pagination(topUpMeta)}
        </>
      );
    }

    if (section === 'payouts') {
      return (
        <>
          {uiRedoNote()}
          {filterBar}
          <button type="button" className="social-button" style={{ marginBottom: 12 }} onClick={() => void exportData('payouts')}>Xuất Excel</button>
          {tableWrap(
            <table className="admin-table">
              <thead><tr><th>Mã</th><th>User</th><th>Loại</th><th>Số tiền</th><th>Trạng thái</th><th>Tạo lúc</th><th>Đã chi</th><th>Thao tác</th></tr></thead>
              <tbody>
                {payouts.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28 }}>Không có payout.</td></tr>}
                {payouts.map(row => (
                  <tr key={row.id} style={row.id === payoutIdParam ? { background: 'rgba(0,107,44,0.07)' } : undefined}>
                    <td>#{row.id}</td><td>#{row.userId}</td><td>{row.requestType}</td>
                    <td><strong>{money(row.amount)}</strong></td><td>{statusPill(row.status)}</td>
                    <td>{dateTime(row.createdAt)}</td><td>{dateTime(row.paidAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {row.status === 'PENDING' && <button type="button" className="social-button" onClick={() => void payoutAction(row, 'approve')}>Duyệt</button>}
                        {row.status === 'PENDING' && <button type="button" className="social-button" onClick={() => void payoutAction(row, 'reject')}>Từ chối</button>}
                        {row.status === 'APPROVED' && <button type="button" className="social-button" onClick={() => void payoutAction(row, 'paid')}>Đã chi</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>,
          )}
          {pagination(payoutMeta)}
        </>
      );
    }

    if (section === 'refunds') {
      return (
        <>
          {uiRedoNote()}
          {filterBar}
          <button type="button" className="social-button" style={{ marginBottom: 12 }} onClick={() => void exportData('refunds')}>Xuất Excel</button>
          {tableWrap(
            <table className="admin-table">
              <thead><tr><th>Payment</th><th>Booking</th><th>User</th><th>Số tiền</th><th>Trạng thái</th><th>Lần thử</th><th>Lỗi gần nhất</th><th>Cập nhật</th><th>Thao tác</th></tr></thead>
              <tbody>
                {refunds.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 28 }}>Không có refund.</td></tr>}
                {refunds.map(row => (
                  <tr key={row.paymentId} style={row.paymentId === paymentIdParam ? { background: 'rgba(0,107,44,0.07)' } : undefined}>
                    <td>#{row.paymentId}</td><td>{row.bookingId ? `#${row.bookingId}` : '—'}</td><td>{row.userId ? `#${row.userId}` : '—'}</td>
                    <td><strong>{money(row.amount)}</strong></td><td>{statusPill(row.status)}</td><td>{row.attempts}</td>
                    <td style={{ maxWidth: 280, whiteSpace: 'normal' }}>{row.lastError || '—'}</td>
                    <td>{dateTime(row.updatedAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {row.status === 'FAILED' && <button type="button" className="social-button" onClick={() => void retryRefund(row)}>Retry</button>}
                        <button type="button" className="social-button" onClick={() => void resolveRefund(row)}>Ghi chú</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>,
          )}
          {pagination(refundMeta)}
        </>
      );
    }

    if (section === 'owner-earnings') {
      const pendingSettlements = ownerSettlements.filter(row => row.status === 'PENDING');
      return (
        <>
          {uiRedoNote()}
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Khi cấu hình “Tự động cộng ví chủ sân” đang tắt, booking hoàn tất sẽ nằm ở tab Chờ duyệt.
            Admin duyệt thì hệ thống cộng ví Owner; từ chối thì không cộng.
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <button type="button" className="social-button" onClick={() => void runOwnerSweep(true)}>Dry-run sweep</button>
            <button type="button" className="social-button" onClick={() => void runOwnerSweep(false)}>Chạy sweep</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button type="button" className="social-button" onClick={() => setOwnerEarningView('PENDING')} style={{ fontWeight: ownerEarningView === 'PENDING' ? 800 : 500 }}>
              Chờ duyệt ({pendingSettlements.length})
            </button>
            <button type="button" className="social-button" onClick={() => setOwnerEarningView('LEDGER')} style={{ fontWeight: ownerEarningView === 'LEDGER' ? 800 : 500 }}>
              Đã cộng
            </button>
          </div>
          {ownerEarningView === 'PENDING' && (
            <>
              {tableWrap(
                <table className="admin-table">
                  <thead><tr><th>Mã</th><th>Booking</th><th>Owner</th><th>Số tiền</th><th>Trạng thái</th><th>Mode</th><th>Tạo lúc</th><th>Thao tác</th></tr></thead>
                  <tbody>
                    {ownerSettlements.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28 }}>Chưa có settlement.</td></tr>}
                    {ownerSettlements.map(row => (
                      <tr key={row.id} style={row.id === settlementIdParam ? { background: 'rgba(0,107,44,0.07)' } : undefined}>
                        <td>#{row.id}</td>
                        <td>{row.bookingCode ? `${row.bookingCode} · #${row.bookingId}` : `#${row.bookingId}`}</td>
                        <td>#{row.ownerId} · {row.ownerEmail}</td>
                        <td><strong>{money(row.amount)}</strong></td>
                        <td>{statusPill(row.status)}</td>
                        <td>{row.mode}</td>
                        <td>{dateTime(row.createdAt)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {row.status === 'PENDING' && <button type="button" className="social-button" onClick={() => void ownerSettlementAction(row, 'approve')}>Duyệt &amp; cộng ví</button>}
                            {row.status === 'PENDING' && <button type="button" className="social-button" onClick={() => void ownerSettlementAction(row, 'reject')}>Từ chối</button>}
                            {row.status !== 'PENDING' && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.note || '—'}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>,
              )}
              {pagination(ownerSettlementMeta)}
            </>
          )}
          {ownerEarningView === 'LEDGER' && (
            <>
              {tableWrap(
                <table className="admin-table">
                  <thead><tr><th>Mã</th><th>Owner</th><th>Booking</th><th>Loại</th><th>Số tiền</th><th>Số dư sau</th><th>Diễn giải</th><th>Thời gian</th></tr></thead>
                  <tbody>
                    {ownerEarnings.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28 }}>Chưa có owner earning.</td></tr>}
                    {ownerEarnings.map(row => (
                      <tr key={row.id}>
                        <td>#{row.id}</td><td>#{row.ownerId} · {row.ownerEmail}</td>
                        <td>{row.bookingId ? `#${row.bookingId}${row.bookingCode ? ` · ${row.bookingCode}` : ''}` : '—'}</td>
                        <td>{row.entryType}</td><td><strong>{money(row.amount)}</strong></td>
                        <td>{money(row.balanceAfter)}</td><td>{row.description || '—'}</td><td>{dateTime(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>,
              )}
              {pagination(ownerEarningMeta)}
            </>
          )}
        </>
      );
    }

    if (section === 'reconciliation') {
      return (
        <>
          {uiRedoNote()}
          {filterBar}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <button type="button" className="social-button" onClick={() => void load()}>Chạy đối soát</button>
            <button type="button" className="social-button" onClick={() => void exportData('reconciliation')}>Xuất Excel</button>
          </div>
          {!reconciliation && <p>Chưa chạy đối soát.</p>}
          {reconciliation && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={cardStyle()}>Checks: <strong>{reconciliation.summary.checks}</strong></div>
                <div style={cardStyle()}>Lệch: <strong>{reconciliation.summary.failed}</strong></div>
                <div style={cardStyle()}>Truncated: <strong>{reconciliation.summary.truncated ? 'Có' : 'Không'}</strong></div>
              </div>
              {tableWrap(
                <table className="admin-table">
                  <thead><tr><th>Key</th><th>Loại</th><th>Entity</th><th>Expected</th><th>Actual</th><th>Delta</th><th>Thông điệp</th><th /></tr></thead>
                  <tbody>
                    {reconciliation.discrepancies.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28 }}>Không phát hiện lệch.</td></tr>}
                    {reconciliation.discrepancies.map(row => (
                      <tr key={row.key}>
                        <td>{row.key}</td><td>{row.type}</td><td>{row.entityType}{row.entityId ? `:${row.entityId}` : ''}</td>
                        <td>{row.expected}</td><td>{row.actual}</td><td>{row.delta}</td>
                        <td style={{ maxWidth: 320, whiteSpace: 'normal' }}>{row.message}</td>
                        <td><button type="button" className="social-button" onClick={() => void resolveDiscrepancy(row.key)}>Resolve</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>,
              )}
            </>
          )}
        </>
      );
    }

    if (section === 'reports') {
      return (
        <>
          {uiRedoNote()}
          {filterBar}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <button type="button" className="social-button" onClick={() => void exportData('revenue')}>Xuất revenue</button>
            <button type="button" className="social-button" onClick={() => void exportData('cash-flow')}>Xuất cash-flow</button>
          </div>
          {!report && <p>Không có báo cáo.</p>}
          {report && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div style={cardStyle()}>Gross<br /><strong>{money(report.totals.grossRevenue)}</strong></div>
                <div style={cardStyle()}>Refunds<br /><strong>{money(report.totals.refunds)}</strong></div>
                <div style={cardStyle()}>Net ước tính<br /><strong>{money(report.totals.netEstimated)}</strong></div>
                <div style={cardStyle()}>Owner earnings<br /><strong>{money(report.totals.ownerEarnings)}</strong></div>
                <div style={cardStyle()}>Cash in<br /><strong>{money(report.totals.cashIn)}</strong></div>
                <div style={cardStyle()}>Cash out<br /><strong>{money(report.totals.cashOut)}</strong></div>
              </div>
              {tableWrap(
                <table className="admin-table">
                  <thead><tr><th>Nhóm</th><th>Nhãn</th><th>Gross</th><th>Refunds</th><th>Net ước tính</th><th>Owner earnings</th></tr></thead>
                  <tbody>
                    {report.rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28 }}>Không có dữ liệu trong kỳ.</td></tr>}
                    {report.rows.map(row => (
                      <tr key={row.key}>
                        <td>{row.key}</td><td>{row.label}</td><td>{money(row.gross)}</td><td>{money(row.refunds)}</td>
                        <td>{money(row.net)}</td><td>{money(row.ownerEarnings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>,
              )}
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Revenue là số ước tính vận hành, không phải số kế toán/quyết toán.</p>
            </>
          )}
        </>
      );
    }

    return (
      <>
        {uiRedoNote()}
        {filterBar}
        {tableWrap(
          <table className="admin-table">
            <thead><tr><th>Thời gian</th><th>Actor</th><th>Action</th><th>Entity</th><th>Metadata</th></tr></thead>
            <tbody>
              {audits.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 28 }}>Chưa có audit.</td></tr>}
              {audits.map(row => (
                <tr key={row.id}>
                  <td>{dateTime(row.createdAt)}</td><td>#{row.actorId}</td><td>{row.action}</td>
                  <td>{row.entityType}{row.entityId ? `:${row.entityId}` : ''}</td>
                  <td style={{ maxWidth: 480, whiteSpace: 'normal', fontSize: 12 }}>{JSON.stringify(row.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>,
        )}
        {pagination(auditMeta)}
      </>
    );
  }, [loading, error, section, overview, transactions, transactionMeta, detail, wallet, walletEntries, walletMeta, walletId, topUps, topUpMeta, payouts, payoutMeta, payoutIdParam, refunds, refundMeta, paymentIdParam, ownerEarnings, ownerEarningMeta, ownerSettlements, ownerSettlementMeta, ownerEarningView, settlementIdParam, reconciliation, report, audits, auditMeta, filterBar, load, range, groupBy]);

  return (
    <div className="admin-layout">
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(value => !value)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />
      <div className={`admin-main-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <AdminHeader isCollapsed={isCollapsed} onToggleMobileSidebar={() => setIsMobileOpen(true)} />
        <main style={{ padding: '96px 20px 48px', maxWidth: 1500, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <div className="page-top-header">
            <div className="page-top-header-info">
              <h1 className="page-top-header-title">Quản lý tài chính</h1>
              <p className="page-top-header-desc">Vận hành ví, nạp tiền, payout, hoàn tiền, owner earnings, đối soát và báo cáo.</p>
            </div>
          </div>
          <nav style={{ display: 'flex', gap: 8, margin: '18px 0', flexWrap: 'wrap' }}>
            {SECTIONS.map(item => (
              <Link
                key={item.key}
                to={item.path}
                style={{
                  padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  background: item.key === activeSection.key ? 'var(--color-brand)' : '#EEF1EE',
                  color: item.key === activeSection.key ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {toast && <p role="status" style={{ color: 'var(--color-brand)', fontWeight: 600 }}>{toast}</p>}
          {body}
        </main>
      </div>
    </div>
  );
};
