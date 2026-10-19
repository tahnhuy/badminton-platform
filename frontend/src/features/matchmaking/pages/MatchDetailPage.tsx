import { PlayerProfileButton } from '../../player/profile/PlayerProfileButton';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePollingResource } from '../hooks/usePollingResource';
import { matchmakingService } from '../services/matchmakingService';
import { Countdown, StateBlock, StatusPill } from '../components/StateBlocks';
const reasons: Record<string, string> = { COURT_NOT_BOOKED: 'Chưa đặt được sân trước giờ chơi.', BOOKING_CANCELLED: 'Booking sân đã bị hủy.', INSUFFICIENT_PLAYERS: 'Một thành viên đã rời trận.' };
const format = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
export function MatchDetailPage() {
  const { matchId } = useParams();
  const load = useCallback(() => matchmakingService.getMatch(Number(matchId)), [matchId]);
  const { data, loading, error, refresh } = usePollingResource(load);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const leave = async () => {
    setBusy(true); setActionError(null);
    try { await matchmakingService.leaveMatch(Number(matchId)); setConfirmLeave(false); refresh(); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : 'Không thể rời trận.'); }
    finally { setBusy(false); }
  };
  const canLeave = data && (data.status === 'PENDING_COURT' || data.status === 'CONFIRMED');
  return <main style={{ maxWidth: 1000, margin: 'auto', padding: 24 }}>
    <Link to="/matchmaking/matches">← Các trận của tôi</Link><h1>Chi tiết trận</h1>
    {loading && <p>Đang tải...</p>}
    {error && <StateBlock title="Không thể xem trận" description={error.message} actionLabel="Thử lại" onAction={refresh} />}
    {actionError && <p role="alert">{actionError}</p>}
    {data && <>
      <StatusPill status={data.status} /><p>{data.matchType === 'SINGLES' ? 'Đơn' : 'Đôi'} · {data.currentPlayers}/{data.requiredPlayers} người</p>
      <p>{format(data.scheduledAt)}{data.scheduledEndAt ? ` – ${format(data.scheduledEndAt)}` : ' (giờ dự kiến)'}</p>
      {data.facility ? <p>{data.facility.name} · {data.court?.name}<br />{data.facility.address}, {data.facility.district}, {data.facility.city}</p> : <p>Chưa có sân.</p>}
      {data.price !== null && <p>Giá sân: {data.price.toLocaleString('vi-VN')} ₫ · Người thanh toán: {data.players.find(p => p.playerId === data.payer?.playerId)?.displayName ?? 'Chủ kèo'}</p>}
      <ul>{data.players.map(player => <li key={player.playerId}><PlayerProfileButton playerId={player.playerId} displayName={player.displayName} /> · Đội {player.teamNo} · {player.skill?.name}{player.status === 'LEFT' ? ' · Đã rời' : ''}</li>)}</ul>
      {data.status === 'PENDING_COURT' && data.bookingDeadlineAt && <p>Hạn đặt sân: <Countdown expiresAt={data.bookingDeadlineAt} /></p>}
      {data.status === 'PENDING_COURT' && data.isOwner && <Link to="/courts">Tìm sân cho nhóm</Link>}
      {data.isOwner && data.booking && <Link to={`/bookings/${data.booking.id}`}>Xem booking sân</Link>}
      {data.status === 'CANCELLED' && <p>{reasons[data.cancellationReason ?? ''] ?? 'Trận đã bị hủy.'} <Link to="/matchmaking">Tạo yêu cầu mới</Link></p>}
      {canLeave && !confirmLeave && <button onClick={() => setConfirmLeave(true)}>Rời trận</button>}
      {canLeave && confirmLeave && <div role="alert"><p>Rời trận sẽ hủy kèo cho cả nhóm. Booking đã liên kết sẽ được yêu cầu hủy theo chính sách.</p>
        <button disabled={busy} onClick={() => void leave()}>{busy ? 'Đang xử lý...' : 'Xác nhận rời trận'}</button>
        <button disabled={busy} onClick={() => setConfirmLeave(false)}>Ở lại</button>
      </div>}
    </>}
  </main>;
}
