import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePollingResource } from '../hooks/usePollingResource';
import { matchmakingService } from '../services/matchmakingService';
import { StateBlock, StatusPill } from '../components/StateBlocks';
export function MyMatchesPage() {
  const [page, setPage] = useState(1);
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
    </li>)}</ul>
    {data && data.meta.totalPages > 1 && <nav aria-label="Trang trận đấu">
      <button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Trước</button>
      <span> {page}/{data.meta.totalPages} </span>
      <button disabled={page >= data.meta.totalPages} onClick={() => setPage(value => value + 1)}>Sau</button>
    </nav>}
  </main>;
}
