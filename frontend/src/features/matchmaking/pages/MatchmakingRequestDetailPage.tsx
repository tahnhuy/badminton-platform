import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePollingResource } from '../hooks/usePollingResource';
import { matchmakingService } from '../services/matchmakingService';
import { CandidateList } from '../components/CandidateList';
import { Countdown, StateBlock, StatusPill } from '../components/StateBlocks';

export function MatchmakingRequestDetailPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const load = useCallback(() => matchmakingService.getRequest(Number(requestId)), [requestId]);
  const { data, error, loading, refresh } = usePollingResource(load);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const act = async (command: () => Promise<unknown>) => {
    setBusy(true); setActionError(null);
    try { await command(); refresh(); } catch (reason) { setActionError(reason instanceof Error ? reason.message : 'Thao tác thất bại.'); }
    finally { setBusy(false); }
  };
  return <main style={{ maxWidth: 1000, margin: 'auto', padding: 24 }}>
    <Link to="/matchmaking">← Ghép trận</Link>
    <h1>Nhóm chơi</h1>
    {loading && <StateBlock title="Đang tải nhóm..." description="Vui lòng chờ." />}
    {error && <StateBlock title="Không thể xem nhóm" description={error.message} actionLabel="Thử lại" onAction={refresh} />}
    {actionError && <p role="alert">{actionError}</p>}
    {data && <>
      <StatusPill status={data.status} />
      <p>{data.preferredDate} · {data.preferredStartTime.slice(0,5)}–{data.preferredEndTime.slice(0,5)} · {data.area}</p>
      {data.status === 'OPEN' && <><p>{data.currentPlayers}/{data.requiredPlayers} người · Còn thiếu {data.remainingCount} người</p><Countdown expiresAt={data.expiresAt} /></>}
      <ul>{data.members.map(member => <li key={member.playerId}>{member.displayName ?? 'Người chơi'} · {member.skill?.name ?? 'Chưa có trình độ'}{member.isOwner ? ' · Chủ kèo' : ''}</li>)}</ul>
      {data.matchId && <Link to={`/matchmaking/matches/${data.matchId}`}>Xem trận đã hình thành</Link>}
      {data.status === 'OPEN' && data.isOwner && <>
        <button disabled={busy} onClick={() => void act(() => matchmakingService.cancelRequest(data.id))}>Hủy yêu cầu</button>
        <CandidateList requestId={data.id} onInvited={refresh} />
        <Link to="/matchmaking/invitations">Quản lý lời mời</Link>
      </>}
      {data.status === 'OPEN' && !data.isOwner && data.invitationId && <button disabled={busy} onClick={() => void act(async () => { await matchmakingService.withdrawInvitation(data.invitationId!); navigate("/matchmaking/invitations"); })}>Rút khỏi nhóm</button>}
      {(data.status === 'CANCELLED' || data.status === 'EXPIRED') && <p>Nhóm đã đóng. Hãy tạo yêu cầu mới để tiếp tục.</p>}
    </>}
  </main>;
}
