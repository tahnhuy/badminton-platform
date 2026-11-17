import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePollingResource } from '../hooks/usePollingResource';
import { matchmakingService } from '../services/matchmakingService';
import { StateBlock } from '../components/StateBlocks';
import { MatchHero, MatchSchedule, MatchTeams, MatchCost } from '../components/match-detail/MatchInfo';
import { MatchActions } from '../components/match-detail/MatchActions';
import { LeaveMatchDialog } from '../components/match-detail/LeaveMatchDialog';
import { cancellationReasons } from '../utils/matchDetail';
import type { MatchDetail } from '../types/matchmaking';
import '../match-detail.css';

function MatchDetailView({ matchId }: { matchId: number }) {
  const load = useCallback(() => matchmakingService.getMatch(matchId), [matchId]);
  const { data, loading, error, refresh } = usePollingResource(load);
  const [leaving, setLeaving] = useState<MatchDetail | null>(null);
  return <section className="match-detail-page">
    <nav className="match-breadcrumb" aria-label="Điều hướng chi tiết trận"><Link to="/matchmaking/matches">← Các trận của tôi</Link><span>/</span><span>Trận #{matchId}</span></nav>
    {loading && !data && <div className="match-loading" role="status"><div className="match-skeleton match-skeleton-hero" /><div className="match-skeleton match-skeleton-panel" /><span>Đang tải chi tiết trận...</span></div>}
    {error && !data && <StateBlock title="Không thể xem trận" description={error.message} actionLabel="Thử lại" onAction={refresh} />}
    {error && data && <div className="match-error" role="alert"><p>Chưa cập nhật được trạng thái mới nhất. Thông tin bên dưới có thể đã thay đổi.</p><button className="match-button match-button-secondary" onClick={refresh}>Tải lại trạng thái</button></div>}
    {data && <>
      <MatchHero match={data} />
      {data.status === 'CANCELLED' && <div className="match-cancelled-notice" role="status"><strong>Trận đấu đã bị hủy</strong><p>{cancellationReasons[data.cancellationReason ?? ''] ?? 'Trận đã bị hủy.'}</p><p>Không có đánh giá sau trận cho trận đã hủy.</p></div>}
      <div className="match-detail-grid"><div className="match-main-column"><MatchSchedule match={data} /><MatchTeams match={data} /></div>
        <aside className="match-side-column"><MatchActions match={data} stale={Boolean(error)} onLeave={() => setLeaving(data)} onRefresh={refresh} /><MatchCost match={data} /></aside>
      </div>
    </>}
    {leaving && <LeaveMatchDialog canSubmit={Boolean(data && !error && ['PENDING_COURT', 'CONFIRMED'].includes(data.status))} match={leaving} onClose={() => setLeaving(null)} onComplete={() => { setLeaving(null); refresh(); }} onConflict={refresh} />}
  </section>;
}

export function MatchDetailPage() {
  const { matchId } = useParams();
  const id = Number(matchId);
  if (!Number.isSafeInteger(id) || id <= 0) return <section className="match-detail-page"><StateBlock title="Không tìm thấy trận đấu" description="Mã trận không hợp lệ." /><Link to="/matchmaking/matches">← Các trận của tôi</Link></section>;
  return <MatchDetailView key={id} matchId={id} />;
}
