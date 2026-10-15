import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePollingResource } from '../hooks/usePollingResource';
import { matchmakingService } from '../services/matchmakingService';
import { StateBlock, StatusPill } from '../components/StateBlocks';
import { useRatingPending } from '../../ratings/hooks/useRatingPending';
import { ratingErrorMessage } from '../../ratings/utils/messages';
import { RatingModal } from '../../ratings/components/RatingModal';
function RatingEntry({ matchId, onOpen }: { matchId: number; onOpen: () => void }) {
  const pending = useRatingPending(matchId, true);
  if (pending.loading) return <p>Đang tải đánh giá...</p>;
  if (pending.error) return <div role="alert">{ratingErrorMessage(pending.error)} <button onClick={pending.refresh}>Thử tải lại đánh giá</button></div>;
  if (!pending.data) return null;
  return <button type="button" onClick={onOpen}>{pending.data.pendingPlayers.length ? 'Đánh giá đối thủ' : 'Xem đánh giá đã gửi'}</button>;
}

export function MyMatchesPage() {
  const [ratingVersion, setRatingVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [ratingMatchId, setRatingMatchId] = useState<number | null>(null);
  const load = useCallback(() => matchmakingService.listMatches(page), [page]);
  const { data, loading, error, refresh } = usePollingResource(load);
  return <main style={{ maxWidth: 1000, margin: 'auto', padding: 24 }}>
    <Link to="/matchmaking">← Ghép trận</Link><h1>Các trận của tôi</h1>
    {loading && <p>Đang tải...</p>}
    {error && <StateBlock title="Không tải được trận" description={error.message} actionLabel="Thử lại" onAction={refresh} />}
    {data?.data.length === 0 && <p>Chưa có trận nào.</p>}
    <ul>{data?.data.map(match => <li key={match.id} style={{ padding: 12 }}>
      <Link to={`/matchmaking/matches/${match.id}`}>{match.matchType === 'SINGLES' ? 'Đơn' : 'Đôi'} · Trận #{match.id}</Link> <StatusPill status={match.status} />
      <p>{new Date(match.scheduledAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {match.facility?.name ?? 'Chưa có sân'}</p>
      {match.status === 'COMPLETED' && (
        <RatingEntry key={`${match.id}:${ratingVersion}`} matchId={match.id} onOpen={() => setRatingMatchId(match.id)} />
      )}
    </li>)}</ul>
    {data && data.meta.totalPages > 1 && <nav aria-label="Trang trận đấu">
      <button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Trước</button>
      <span> {page}/{data.meta.totalPages} </span>
      <button disabled={page >= data.meta.totalPages} onClick={() => setPage(value => value + 1)}>Sau</button>
    </nav>}
    {ratingMatchId !== null && (
      <RatingModal
        matchId={ratingMatchId}
        isOpen
        onClose={() => setRatingMatchId(null)}
        onSubmitted={() => { refresh(); setRatingVersion(value => value + 1); }}
      />
    )}
  </main>;
}
