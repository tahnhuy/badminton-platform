import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminHeader } from '../components/AdminHeader';
import { AdminSidebar } from '../components/AdminSidebar';
import { ApiError } from '../../../shared/api/http-client';
import { adminWalletService } from './services/adminWalletService';
import type { AdminPayout, AdminRefund, PayoutStatus, Reconciliation, RefundPageMeta, RefundStatus } from './types';

type WalletSection = 'payouts' | 'refunds' | 'reconciliation';

const SECTION_META: Record<WalletSection, { path: string; label: string; title: string; description: string }> = {
  payouts: {
    path: '/admin/wallet/payouts',
    label: 'Payout',
    title: 'Duyệt payout & rút ví',
    description: 'Xử lý yêu cầu rút ví của người chơi và chi trả cho chủ sân.',
  },
  refunds: {
    path: '/admin/wallet/refunds',
    label: 'Hoàn tiền',
    title: 'Hoàn tiền cần can thiệp',
    description: 'Theo dõi các khoản hoàn tiền thất bại và nguyên nhân gần nhất.',
  },
  reconciliation: {
    path: '/admin/wallet/reconciliation',
    label: 'Đối soát',
    title: 'Đối soát ví & giao dịch',
    description: 'So khớp top-up, payout với bút toán ledger và phát hiện bản ghi lệch.',
  },
};

const PAYOUT_STATUSES: PayoutStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'FAILED'];
const REFUND_STATUSES: RefundStatus[] = ['PENDING', 'PROCESSING', 'REFUNDED', 'FAILED'];

const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', PAID: 'Đã chi', FAILED: 'Thất bại',
};
const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  PENDING: 'Chờ xử lý', PROCESSING: 'Đang xử lý', REFUNDED: 'Đã hoàn', FAILED: 'Thất bại',
};

function money(value: string | number): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString('vi-VN')}đ` : String(value);
}

function dateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

const pillStyle: React.CSSProperties = {
  display: 'inline-flex', padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
};

function statusPill(status: PayoutStatus | RefundStatus, kind: 'payout' | 'refund') {
  const failed = status === 'FAILED' || status === 'REJECTED';
  const done = status === 'PAID' || status === 'REFUNDED';
  return (
    <span style={{
      ...pillStyle,
      background: failed ? '#FDE7E7' : done ? '#E3F4E8' : '#FFF3D8',
      color: failed ? '#A11A1A' : done ? '#0B6B2E' : '#7A4A00',
    }}>
      {kind === 'payout'
        ? PAYOUT_STATUS_LABEL[status as PayoutStatus]
        : REFUND_STATUS_LABEL[status as RefundStatus]}
    </span>
  );
}

export const AdminWalletPage: React.FC<{ section: WalletSection }> = ({ section }) => {
  const [searchParams] = useSearchParams();
  const payoutIdParam = searchParams.get('payoutId');
  const paymentIdParam = searchParams.get('paymentId');
  const payoutId = Number(payoutIdParam);
  const paymentId = Number(paymentIdParam);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus | ''>(
    section === 'payouts' && !payoutIdParam ? 'PENDING' : '',
  );
  const [refunds, setRefunds] = useState<AdminRefund[]>([]);
  const [refundStatus, setRefundStatus] = useState<RefundStatus | ''>(paymentIdParam ? '' : 'FAILED');
  const [refundPage, setRefundPage] = useState(1);
  const [refundMeta, setRefundMeta] = useState<RefundPageMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);

  const meta = SECTION_META[section];

  // A notification deep link must reveal its row even when it is outside the
  // default filter (e.g. an APPROVED payout from an ADMIN_PAYOUT_FAILED alert).
  useEffect(() => {
    if (payoutIdParam) setPayoutStatus('');
  }, [payoutIdParam]);

  useEffect(() => {
    if (paymentIdParam) setRefundStatus('');
  }, [paymentIdParam]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (section === 'payouts') {
        setPayouts(await adminWalletService.payouts(payoutStatus || undefined));
      } else if (section === 'refunds') {
        const response = await adminWalletService.refunds({ status: refundStatus || undefined, page: refundPage, limit: 20 });
        setRefunds(response.data);
        setRefundMeta(response.meta);
      } else {
        setReconciliation(await adminWalletService.reconciliation());
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể tải dữ liệu ví.');
    } finally {
      setLoading(false);
    }
  }, [section, payoutStatus, refundStatus, refundPage]);

  useEffect(() => { void load(); }, [load]);

  const payoutAction = useCallback(async (payout: AdminPayout, action: 'approve' | 'reject' | 'paid') => {
    setBusyId(payout.id);
    setError('');
    try {
      if (action === 'approve') {
        const note = window.prompt('Ghi chú duyệt (không bắt buộc)');
        if (note === null) return;
        await adminWalletService.approvePayout(payout.id, note.trim() || undefined);
      } else if (action === 'reject') {
        const note = window.prompt('Lý do từ chối (bắt buộc)');
        if (!note?.trim()) return;
        await adminWalletService.rejectPayout(payout.id, note.trim());
      } else {
        const reference = window.prompt('Mã giao dịch chuyển khoản (bắt buộc)');
        if (!reference?.trim()) return;
        await adminWalletService.markPayoutPaid(payout.id, reference.trim());
      }
      setToast(`Đã cập nhật payout #${payout.id}.`);
      window.setTimeout(() => setToast(''), 4000);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể cập nhật payout.');
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const content = useMemo(() => {
    if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Đang tải dữ liệu…</p>;
    if (error) return <p role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>;

    if (section === 'payouts') {
      return (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <select value={payoutStatus} onChange={event => setPayoutStatus(event.target.value as PayoutStatus | '')}
              style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(189,202,186,0.6)' }}>
              <option value="">Tất cả trạng thái</option>
              {PAYOUT_STATUSES.map(status => <option key={status} value={status}>{PAYOUT_STATUS_LABEL[status]}</option>)}
            </select>
            <button type="button" className="social-button" onClick={() => void load()}>Làm mới</button>
          </div>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead><tr><th>Mã</th><th>Người yêu cầu</th><th>Loại</th><th>Số tiền</th><th>Trạng thái</th><th>Tạo lúc</th><th>Thao tác</th></tr></thead>
              <tbody>
                {payouts.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28 }}>Không có payout phù hợp.</td></tr>}
                {payouts.map(payout => (
                  <tr key={payout.id} style={payout.id === payoutId ? { background: 'rgba(0,107,44,0.07)' } : undefined}>
                    <td><strong>#{payout.id}</strong></td>
                    <td>User #{payout.userId}</td>
                    <td>{payout.requestType === 'OWNER_PAYOUT' ? 'Chi trả chủ sân' : 'Rút ví'}</td>
                    <td><strong>{money(payout.amount)}</strong></td>
                    <td>{statusPill(payout.status, 'payout')}</td>
                    <td>{dateTime(payout.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {payout.status === 'PENDING' && <button type="button" className="social-button" disabled={busyId === payout.id} onClick={() => void payoutAction(payout, 'approve')}>Duyệt</button>}
                        {payout.status === 'PENDING' && <button type="button" className="social-button" disabled={busyId === payout.id} onClick={() => void payoutAction(payout, 'reject')}>Từ chối</button>}
                        {payout.status === 'APPROVED' && <button type="button" className="social-button" disabled={busyId === payout.id} onClick={() => void payoutAction(payout, 'paid')}>Đã chi</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (section === 'refunds') {
      return (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <select value={refundStatus} onChange={event => { setRefundStatus(event.target.value as RefundStatus | ''); setRefundPage(1); }}
              style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(189,202,186,0.6)' }}>
              <option value="">Tất cả trạng thái</option>
              {REFUND_STATUSES.map(status => <option key={status} value={status}>{REFUND_STATUS_LABEL[status]}</option>)}
            </select>
            <button type="button" className="social-button" onClick={() => void load()}>Làm mới</button>
          </div>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead><tr><th>Payment</th><th>Booking</th><th>Số tiền</th><th>Provider</th><th>Trạng thái</th><th>Lỗi gần nhất</th><th>Cập nhật</th></tr></thead>
              <tbody>
                {refunds.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28 }}>Không có khoản hoàn tiền phù hợp.</td></tr>}
                {refunds.map(refund => (
                  <tr key={refund.paymentId} style={refund.paymentId === paymentId ? { background: 'rgba(0,107,44,0.07)' } : undefined}>
                    <td><strong>#{refund.paymentId}</strong></td>
                    <td>{refund.bookingId ? `#${refund.bookingId}` : '—'}</td>
                    <td><strong>{money(refund.amount)}</strong></td>
                    <td>{refund.provider}</td>
                    <td>{statusPill(refund.status, 'refund')}</td>
                    <td style={{ maxWidth: 320, whiteSpace: 'normal' }}>{refund.lastError || '—'}</td>
                    <td>{dateTime(refund.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {refundMeta.totalPages > 1 && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
              <button type="button" className="social-button" disabled={refundPage <= 1} onClick={() => setRefundPage(page => Math.max(1, page - 1))}>Trước</button>
              <span style={{ alignSelf: 'center', fontSize: 13 }}>Trang {refundMeta.page}/{refundMeta.totalPages}</span>
              <button type="button" className="social-button" disabled={refundPage >= refundMeta.totalPages} onClick={() => setRefundPage(page => page + 1)}>Sau</button>
            </div>
          )}
        </>
      );
    }

    if (!reconciliation) return <p>Không có dữ liệu đối soát.</p>;
    const cards = [
      ['Top-up thành công', reconciliation.topUps.success_count, reconciliation.topUps.success_amount],
      ['Bút toán top-up', reconciliation.topUpLedger.entry_count, reconciliation.topUpLedger.entry_amount],
      ['Payout đã chi', reconciliation.payouts.paid_count, reconciliation.payouts.paid_amount],
      ['Bút toán payout', reconciliation.payoutLedger.entry_count, reconciliation.payoutLedger.entry_amount],
    ] as const;
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          {cards.map(([label, count, amount]) => (
            <div key={label} style={{ background: '#fff', border: '1px solid rgba(189,202,186,0.45)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{String(count)}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{money(String(amount))}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, background: '#fff', border: '1px solid rgba(189,202,186,0.45)', borderRadius: 12, padding: 16 }}>
          <strong>Bản ghi cần kiểm tra</strong>
          <p style={{ margin: '8px 0 0', fontSize: 13.5 }}>
            Top-up lệch: {reconciliation.unmatchedTopUpIds.length ? reconciliation.unmatchedTopUpIds.map(id => `#${id}`).join(', ') : 'Không có'}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>
            Payout lệch: {reconciliation.unmatchedPayoutIds.length ? reconciliation.unmatchedPayoutIds.map(id => `#${id}`).join(', ') : 'Không có'}
          </p>
        </div>
      </>
    );
  }, [loading, error, section, payouts, payoutStatus, payoutId, refunds, refundStatus, refundMeta, refundPage, paymentId, reconciliation, busyId, load, payoutAction]);

  return (
    <div className="admin-layout">
      <AdminSidebar isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(value => !value)}
        isMobileOpen={isMobileOpen} onMobileClose={() => setIsMobileOpen(false)} />
      <div className={`admin-main-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <AdminHeader isCollapsed={isCollapsed} onToggleMobileSidebar={() => setIsMobileOpen(true)} />
        <main style={{ padding: '96px 20px 48px', maxWidth: 1400, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <div className="page-top-header">
            <div className="page-top-header-info">
              <h1 className="page-top-header-title">{meta.title}</h1>
              <p className="page-top-header-desc">{meta.description}</p>
            </div>
          </div>
          <nav style={{ display: 'flex', gap: 8, margin: '18px 0' }}>
            {(Object.keys(SECTION_META) as WalletSection[]).map(key => (
              <Link key={key} to={SECTION_META[key].path}
                style={{
                  padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  background: key === section ? 'var(--color-brand)' : '#EEF1EE',
                  color: key === section ? '#fff' : 'var(--text-secondary)',
                }}>
                {SECTION_META[key].label}
              </Link>
            ))}
          </nav>
          {toast && <p role="status" style={{ color: 'var(--color-brand)', fontWeight: 600 }}>{toast}</p>}
          {content}
        </main>
      </div>
    </div>
  );
};
