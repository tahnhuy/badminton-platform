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
  return <div className="rating-match-action"><button className="rating-button rating-primary" type="button" onClick={onOpen}>{pending.data.pendingPlayers.length ? 'Đánh giá người chơi' : 'Xem đánh giá đã gửi'}</button><span className="rating-muted">{pending.data.pendingPlayers.length ? `Còn ${pending.data.pendingPlayers.length} người chưa đánh giá` : 'Đã gửi cho tất cả người chơi'}</span></div>;
}

export function MyMatchesPage() {
  const [ratingVersion, setRatingVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [ratingMatchId, setRatingMatchId] = useState<number | null>(null);
  const load = useCallback(() => matchmakingService.listMatches(page), [page]);
  const { data, loading, error, refresh } = usePollingResource(load);
  const ratingMatch = data?.data.find(match => match.id === ratingMatchId);
  return <section className="rating-page">
    <Link to="/matchmaking">← Ghép trận</Link><header className="rating-page-heading"><span className="rating-badge">Lịch sử thi đấu</span><h1>Các trận của tôi</h1><p className="rating-muted">Xem lại trận đấu và gửi đánh giá cho những người đã cùng bạn ra sân.</p></header>
    {loading && <p>Đang tải...</p>}
    {error && <StateBlock title="Không tải được trận" description={error.message} actionLabel="Thử lại" onAction={refresh} />}
    {data?.data.length === 0 && <p>Chưa có trận nào.</p>}
    <ul className="rating-match-list">{data?.data.map(match => <li className="rating-card" key={match.id}>
      <Link className="rating-match-title" to={`/matchmaking/matches/${match.id}`}>{match.matchType === 'GROUP' ? 'Giao lưu' : match.matchType === 'SINGLES' ? 'Đơn' : 'Đôi'} · Trận #{match.id}</Link> <StatusPill status={match.status} />
      <p className="rating-match-context">{new Date(match.scheduledAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {match.facility?.name ?? 'Chưa có sân'}</p>
      {match.status === 'COMPLETED' && (
        <RatingEntry key={`${match.id}:${ratingVersion}`} matchId={match.id} onOpen={() => setRatingMatchId(match.id)} />
      )}
    </li>)}</ul>
    {data && data.meta.totalPages > 1 && <nav className="rating-pagination" aria-label="Trang trận đấu">
      <button className="rating-button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Trước</button>
      <span> {page}/{data.meta.totalPages} </span>
      <button className="rating-button" disabled={page >= data.meta.totalPages} onClick={() => setPage(value => value + 1)}>Sau</button>
    </nav>}
    {ratingMatchId !== null && (
      <RatingModal
        matchId={ratingMatchId}
        context={ratingMatch ? { scheduledAt: ratingMatch.scheduledAt, facilityName: ratingMatch.facility?.name } : undefined}
        isOpen
        onClose={() => setRatingMatchId(null)}
        onSubmitted={() => { refresh(); setRatingVersion(value => value + 1); }}
      />
    )}
  </section>;
}
