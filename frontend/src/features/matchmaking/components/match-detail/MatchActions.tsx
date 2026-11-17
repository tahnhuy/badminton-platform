import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRatingPending } from '../../../ratings/hooks/useRatingPending';
import { RatingModal } from '../../../ratings/components/RatingModal';
import { ratingErrorMessage } from '../../../ratings/utils/messages';
import type { MatchDetail } from '../../types/matchmaking';
import { Countdown } from '../StateBlocks';
import { BookingPicker } from './BookingPicker';

export function MatchRatingAction({ match }: { match: MatchDetail }) {
  const [open, setOpen] = useState(false);
  const pending = useRatingPending(match.id, true);
  return <>
    {pending.loading && <p role="status">Đang tải đánh giá...</p>}
    {pending.error && <div role="alert" className="match-error"><p>{ratingErrorMessage(pending.error)}</p><button className="match-button match-button-secondary" onClick={pending.refresh}>Thử tải lại đánh giá</button></div>}
    {pending.data && !pending.loading && !pending.error && <>
      <button className="match-button match-button-primary" onClick={() => setOpen(true)}>{pending.data.pendingPlayers.length ? 'Đánh giá người chơi' : 'Xem đánh giá đã gửi'}</button>
      <p className="match-muted">{pending.data.pendingPlayers.length ? `Còn ${pending.data.pendingPlayers.length} người chưa đánh giá` : 'Đã gửi cho tất cả người chơi'}</p>
    </>}
    <RatingModal matchId={match.id} isOpen={open} onClose={() => setOpen(false)} onSubmitted={pending.refresh}
      context={{ scheduledAt: match.scheduledAt, facilityName: match.facility?.name, courtName: match.court?.name }} />
  </>;
}

export function MatchActions({ match, stale, onLeave, onRefresh }: { match: MatchDetail; stale: boolean; onLeave: () => void; onRefresh: () => void }) {
  const canLeave = match.status === 'PENDING_COURT' || match.status === 'CONFIRMED';
  return <section className="match-panel match-action-panel" aria-labelledby="match-actions-title">
    <h2 id="match-actions-title">Thao tác trận đấu</h2>
    {match.status === 'PENDING_COURT' && <>
      {match.bookingDeadlineAt && <div className="match-deadline"><span>Hạn đặt sân</span><strong><Countdown expiresAt={match.bookingDeadlineAt} /></strong><small>{new Date(match.bookingDeadlineAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</small></div>}
      {match.isOwner ? <BookingPicker matchId={match.id} onLinked={onRefresh} />
        : <p className="match-note">Chủ kèo đang phụ trách đặt sân cho nhóm. Bạn sẽ thấy lịch chính thức khi sân được xác nhận.</p>}
    </>}
    {match.status === 'CONFIRMED' && <p className="match-note">Kiểm tra địa chỉ và khung giờ đặt sân. Bạn chỉ có thể rời trước giờ bắt đầu.</p>}
    {match.status === 'IN_PROGRESS' && <p className="match-note">Không thể rời trận khi đã bắt đầu. Phần đánh giá sẽ mở khi hệ thống ghi nhận trận kết thúc.</p>}
    {match.status === 'COMPLETED' && <MatchRatingAction match={match} />}
    {match.status === 'CANCELLED' && <Link className="match-button match-button-primary" to="/matchmaking">Tạo yêu cầu mới</Link>}
    {canLeave && <div className="match-leave-area"><button className="match-button match-leave-button" disabled={stale} onClick={onLeave}>Rời trận</button><p className="match-muted">Rời trận làm hủy kèo cho tất cả thành viên.</p></div>}
  </section>;
}
