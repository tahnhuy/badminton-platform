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
  return <div className="match-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
    <div className="match-dialog" role="dialog" aria-modal="true" aria-labelledby="split-booking-title">
      <div className="match-panel-heading">
        <div>
          <span className="match-eyebrow">ĐẶT SÂN & CHIA TIỀN</span>
          <h2 id="split-booking-title">{courtName}</h2>
        </div>
        <button type="button" className="match-button match-button-secondary" onClick={onClose} disabled={submitting} aria-label="Đóng">Đóng</button>
      </div>

      {loading && <p role="status" className="match-muted">Đang kiểm tra số dư ví và giá sân...</p>}
      {error && !loading && <div role="alert" className="match-error" style={{ marginBottom: 14 }}><p>{error}</p></div>}

      {preview && !loading && <>
        <div className="match-facts">
          <div><span>NGÀY CHƠI</span><strong>{formatDisplayDate(preview.bookingWindow.date)}</strong></div>
          <div><span>KHUNG GIỜ</span><strong>{formatTimeRange(preview.bookingWindow.startTime, preview.bookingWindow.endTime)}</strong></div>
          <div><span>TỔNG TIỀN</span><strong>{formatCurrency(preview.totalAmount)}</strong></div>
          <div><span>MỖI NGƯỜI</span><strong>{formatCurrency(preview.shareAmount)}</strong></div>
        </div>

        <h3 style={{ marginTop: 18, marginBottom: 10, fontSize: 14 }}>Chia đều cho {preview.memberCount} thành viên</h3>
        <ul className="match-cost-shares">
          {preview.members.map(member => <li key={member.playerId}>
            <span>{member.displayName}{member.isHost ? ' (chủ kèo)' : ''}</span>
            <strong>{formatCurrency(member.amount)}</strong>
            <span className={member.sufficient ? 'match-share-paid' : 'match-share-blocked'}>
              {member.sufficient ? 'Đủ số dư' : `Thiếu ${formatCurrency(member.shortfall)}`}
            </span>
          </li>)}
        </ul>

        {blocked.length > 0 && <div className="match-error" role="alert" style={{ marginTop: 16 }}>
          <strong>Chưa thể đặt sân — {blocked.length} thành viên chưa đủ số dư ví</strong>
          <ul className="match-blocked-list">
            {blocked.map(member => <li key={member.playerId}>
              <span>{member.displayName}{member.isHost ? ' (bạn)' : ''}: cần nạp thêm {formatCurrency(member.shortfall)}</span>
              {member.isHost
                ? <Link className="match-button match-button-secondary" to="/wallet">Nạp ví ngay</Link>
                : <button type="button" className="match-button match-button-secondary" disabled={reminding} onClick={() => onRemind([member.playerId])}>Nhắc nạp ví</button>}
            </li>)}
          </ul>
          <div className="match-dialog-actions" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
            <button type="button" className="match-button match-button-secondary" disabled={reminding} onClick={() => onRemind()}>Nhắc tất cả nạp ví</button>
            <button type="button" className="match-button match-button-secondary" onClick={onRefresh}>Kiểm tra lại</button>
          </div>
        </div>}

        <div className="match-dialog-actions" style={{ marginTop: 20 }}>
          <button type="button" className="match-button match-button-secondary" onClick={onClose} disabled={submitting}>Hủy</button>
          <button
            type="button"
            className="match-button match-button-primary"
            disabled={!preview.canBook || submitting}
            onClick={onConfirm}
          >
            {submitting ? 'Đang trừ ví và đặt sân...' : 'Xác nhận đặt sân'}
          </button>
        </div>
        <p className="match-note" style={{ marginTop: 12 }}>
          Khi xác nhận, hệ thống sẽ trừ ví của tất cả thành viên và liên kết sân với trận. Nếu một người không đủ số dư, giao dịch sẽ không thực hiện.
        </p>
        <p className="match-muted" style={{ marginTop: 6 }}>Mã trận #{matchId}</p>
      </>}
    </div>
  </div>;
}
