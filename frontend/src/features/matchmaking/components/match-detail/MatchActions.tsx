import { ContentPanel } from '@/components/common/content-panel';
import { Button } from '@/components/ui/button';
import { LogOut, Swords } from 'lucide-react';
import { matchLeaveImpact } from '../../utils/matchDetail';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRatingPending } from '../../../ratings/hooks/useRatingPending';
import { RatingModal } from '../../../ratings/components/RatingModal';
import { ratingErrorMessage } from '../../../ratings/utils/messages';
import type { MatchDetail } from '../../types/matchmaking';
import { Countdown } from '../MatchStatus';
import { BookingPicker } from './BookingPicker';

export function MatchRatingAction({ match }: { match: MatchDetail }) {
  const [open, setOpen] = useState(false);
  const pending = useRatingPending(match.id, true);
  return <>
    {pending.loading && <p role="status">Đang tải đánh giá...</p>}
    {pending.error && <div role="alert" className="rounded-lg bg-danger-bg p-4 text-sm text-danger"><p>{ratingErrorMessage(pending.error)}</p><Button variant="outline" className="h-11" onClick={pending.refresh}>Thử tải lại đánh giá</Button></div>}
    {pending.data && !pending.loading && !pending.error && <>
      <Button className="h-11" onClick={() => setOpen(true)}>{pending.data.pendingPlayers.length ? 'Đánh giá người chơi' : 'Xem đánh giá đã gửi'}</Button>
      <p className="text-sm leading-6 text-muted-foreground">{pending.data.pendingPlayers.length ? `Còn ${pending.data.pendingPlayers.length} người chưa đánh giá` : 'Đã gửi cho tất cả người chơi'}</p>
    </>}
    <RatingModal matchId={match.id} isOpen={open} onClose={() => setOpen(false)} onSubmitted={pending.refresh}
      context={{ scheduledAt: match.scheduledAt, facilityName: match.facility?.name, courtName: match.court?.name }} />
  </>;
}

export function MatchActions({ match, stale, onLeave, onRefresh }: { match: MatchDetail; stale: boolean; onLeave: () => void; onRefresh: () => void }) {
  const canLeave = match.status === 'PENDING_COURT' || match.status === 'CONFIRMED';
  return <ContentPanel title="Thao tác trận đấu" icon={Swords}>
    {match.status === 'PENDING_COURT' && <>
      {match.bookingDeadlineAt && <div className="flex flex-col gap-2 rounded-lg bg-caution-bg p-4 text-sm text-caution"><span>Hạn đặt sân</span><strong><Countdown expiresAt={match.bookingDeadlineAt} /></strong><small className="text-xs">{new Date(match.bookingDeadlineAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</small></div>}
      {match.isOwner ? <>
        <Button asChild className="h-11"><Link to={`/matchmaking/matches/${match.id}/book`}>Tiến hành đặt sân</Link></Button>
        <p className="text-sm leading-6 text-muted-foreground">Hệ thống sẽ chia đều tiền sân cho tất cả thành viên và trừ ví khi bạn xác nhận. Hoặc liên kết một booking bạn đã thanh toán bên dưới.</p>
        <BookingPicker matchId={match.id} onLinked={onRefresh} />
      </> : <p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Chủ kèo đang phụ trách đặt sân cho nhóm. Chi phí sẽ được chia đều cho các thành viên khi sân được xác nhận.</p>}
    </>}
    {match.status === 'CONFIRMED' && <p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Kiểm tra địa chỉ và khung giờ đặt sân. Bạn chỉ có thể rời trước giờ bắt đầu.</p>}
    {match.status === 'IN_PROGRESS' && <p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Không thể rời trận khi đã bắt đầu. Phần đánh giá sẽ mở khi hệ thống ghi nhận trận kết thúc.</p>}
    {match.status === 'COMPLETED' && <MatchRatingAction match={match} />}
    {match.status === 'CANCELLED' && <Button asChild className="h-11"><Link to="/matchmaking">Tìm kèo mới</Link></Button>}
    {canLeave && <div className="flex flex-col gap-3 border-t border-border pt-4"><Button type="button" variant="danger-soft" className="h-11" disabled={stale} onClick={onLeave}><LogOut aria-hidden="true" />Rời trận</Button><p className="text-xs leading-5 text-muted-foreground">{matchLeaveImpact(match).summary}</p></div>}
  </ContentPanel>;
}
