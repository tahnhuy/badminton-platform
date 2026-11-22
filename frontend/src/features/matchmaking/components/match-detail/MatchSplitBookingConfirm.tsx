import { Link } from 'react-router-dom';
import { formatCurrency, formatDisplayDate, formatTimeRange } from '../../../booking/utils/booking';
import type { MatchBookingPreview } from '../../types/matchmaking';

export function MatchSplitBookingConfirm({
  matchId,
  courtName,
  preview,
  loading,
  error,
  submitting,
  reminding,
  onClose,
  onConfirm,
  onRemind,
  onRefresh,
}: {
  matchId: number;
  courtName: string;
  preview: MatchBookingPreview | null;
  loading: boolean;
  error: string | null;
  submitting: boolean;
  reminding: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onRemind: (playerIds?: number[]) => void;
  onRefresh: () => void;
}) {
  const blocked = preview?.blockedMembers ?? [];
  return <div className="match-dialog-backdrop fixed inset-0 z-1000 flex items-center justify-center bg-foreground/50 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
    <div className="match-dialog w-full max-w-lg max-h-[90dvh] overflow-auto rounded-2xl bg-card px-5 py-6 shadow-lg outline-none sm:p-7 [&_h2]:my-3 [&_h2]:text-2xl" role="dialog" aria-modal="true" aria-labelledby="split-booking-title">
      <div className="match-panel-heading mb-4 flex flex-wrap items-center justify-between gap-2.5 border-b border-border pb-4">
        <div>
          <span className="match-eyebrow text-xs font-bold tracking-wide text-muted-foreground">ĐẶT SÂN & CHIA TIỀN</span>
          <h2 id="split-booking-title">{courtName}</h2>
        </div>
        <button type="button" className="match-button inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold disabled:opacity-50 match-button-secondary bg-secondary text-secondary-foreground" onClick={onClose} disabled={submitting} aria-label="Đóng">Đóng</button>
      </div>

      {loading && <p role="status" className="match-muted text-xs leading-5 text-muted-foreground">Đang kiểm tra số dư ví và giá sân...</p>}
      {error && !loading && <div role="alert" className="match-error mb-5 rounded-lg bg-destructive/10 p-4.5 text-sm leading-6 text-destructive mb-3.5" ><p>{error}</p></div>}

      {preview && !loading && <>
        <div className="match-facts mb-4.5 grid grid-cols-1 gap-3 sm:grid-cols-2 [&>div]:grid [&>div]:gap-2 [&>div]:rounded-lg [&>div]:bg-muted [&>div]:p-3.5 [&_span]:text-2xs [&_span]:font-bold [&_span]:tracking-wide [&_span]:text-muted-foreground [&_strong]:text-sm [&_strong]:leading-6">
          <div><span>NGÀY CHƠI</span><strong>{formatDisplayDate(preview.bookingWindow.date)}</strong></div>
          <div><span>KHUNG GIỜ</span><strong>{formatTimeRange(preview.bookingWindow.startTime, preview.bookingWindow.endTime)}</strong></div>
          <div><span>TỔNG TIỀN</span><strong>{formatCurrency(preview.totalAmount)}</strong></div>
          <div><span>MỖI NGƯỜI</span><strong>{formatCurrency(preview.shareAmount)}</strong></div>
        </div>

        <h3 className="mt-4.5 mb-2.5 text-sm">Chia đều cho {preview.memberCount} thành viên</h3>
        <ul className="match-cost-shares m-0 flex list-none flex-col gap-2 p-0 [&_li]:grid [&_li]:grid-cols-[minmax(0,1fr)_auto_auto] [&_li]:items-center [&_li]:gap-2.5 [&_li]:border-t [&_li]:border-border [&_li]:py-2.5 [&_li]:text-sm [&_li:first-child]:border-0 m-0 flex list-none flex-col gap-2 p-0 [&_li]:grid [&_li]:grid-cols-[minmax(0,1fr)_auto_auto] [&_li]:items-center [&_li]:gap-2.5 [&_li]:border-t [&_li]:border-border [&_li]:py-2.5 [&_li]:text-sm [&_li:first-child]:border-t-0">
          {preview.members.map(member => <li key={member.playerId}>
            <span>{member.displayName}{member.isHost ? ' (chủ kèo)' : ''}</span>
            <strong>{formatCurrency(member.amount)}</strong>
            <span className={member.sufficient ? 'match-share-paid text-xs font-bold text-primary text-xs font-bold text-primary' : 'match-share-blocked text-xs font-bold text-destructive text-xs font-bold text-destructive'}>
              {member.sufficient ? 'Đủ số dư' : `Thiếu ${formatCurrency(member.shortfall)}`}
            </span>
          </li>)}
        </ul>

        {blocked.length > 0 && <div className="match-error mb-5 rounded-lg bg-destructive/10 p-4.5 text-sm leading-6 text-destructive mt-4" role="alert" >
          <strong>Chưa thể đặt sân — {blocked.length} thành viên chưa đủ số dư ví</strong>
          <ul className="match-blocked-list mt-2.5 flex list-none flex-col gap-2 p-0 [&_li]:flex [&_li]:flex-wrap [&_li]:items-center [&_li]:justify-between [&_li]:gap-2.5 [&_li]:text-sm mt-2.5 flex list-none flex-col gap-2 p-0 [&_li]:flex [&_li]:flex-wrap [&_li]:items-center [&_li]:justify-between [&_li]:gap-2.5 [&_li]:text-sm">
            {blocked.map(member => <li key={member.playerId}>
              <span>{member.displayName}{member.isHost ? ' (bạn)' : ''}: cần nạp thêm {formatCurrency(member.shortfall)}</span>
              {member.isHost
                ? <Link className="match-button inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold disabled:opacity-50 match-button-secondary bg-secondary text-secondary-foreground" to="/wallet">Nạp ví ngay</Link>
                : <button type="button" className="match-button inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold disabled:opacity-50 match-button-secondary bg-secondary text-secondary-foreground" disabled={reminding} onClick={() => onRemind([member.playerId])}>Nhắc nạp ví</button>}
            </li>)}
          </ul>
          <div className="match-dialog-actions flex flex-wrap justify-end gap-3 justify-start mt-3" >
            <button type="button" className="match-button inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold disabled:opacity-50 match-button-secondary bg-secondary text-secondary-foreground" disabled={reminding} onClick={() => onRemind()}>Nhắc tất cả nạp ví</button>
            <button type="button" className="match-button inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold disabled:opacity-50 match-button-secondary bg-secondary text-secondary-foreground" onClick={onRefresh}>Kiểm tra lại</button>
          </div>
        </div>}

        <div className="match-dialog-actions flex flex-wrap justify-end gap-3 mt-5" >
          <button type="button" className="match-button inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold disabled:opacity-50 match-button-secondary bg-secondary text-secondary-foreground" onClick={onClose} disabled={submitting}>Hủy</button>
          <button
            type="button"
            className="match-button inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold disabled:opacity-50 match-button-primary border-primary bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!preview.canBook || submitting}
            onClick={onConfirm}
          >
            {submitting ? 'Đang trừ ví và đặt sân...' : 'Xác nhận đặt sân'}
          </button>
        </div>
        <p className="match-note my-4 rounded-lg bg-muted p-3.5 text-xs leading-5 text-muted-foreground mt-3" >
          Khi xác nhận, hệ thống sẽ trừ ví của tất cả thành viên và liên kết sân với trận. Nếu một người không đủ số dư, giao dịch sẽ không thực hiện.
        </p>
        <p className="match-muted text-xs leading-5 text-muted-foreground mt-1.5" >Mã trận #{matchId}</p>
      </>}
    </div>
  </div>;
}
