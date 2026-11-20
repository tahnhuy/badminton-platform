import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageContainer } from '@/components/common/page-layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePollingResource } from '../hooks/usePollingResource';
import { matchmakingService } from '../services/matchmakingService';
import { StateBlock } from '../components/StateBlocks';
import { MatchHero, MatchSchedule, MatchTeams, MatchCost } from '../components/match-detail/MatchInfo';
import { MatchActions } from '../components/match-detail/MatchActions';
import { LeaveMatchDialog } from '../components/match-detail/LeaveMatchDialog';
import { cancellationReasons } from '../utils/matchDetail';
import type { MatchDetail } from '../types/matchmaking';

function MatchDetailView({ matchId }: { matchId: number }) {
  const load = useCallback(() => matchmakingService.getMatch(matchId), [matchId]);
  const { data, loading, error, refresh } = usePollingResource(load);
  const [leaving, setLeaving] = useState<MatchDetail | null>(null);
  return <PageContainer className="max-w-320">
    <nav className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:rounded-md [&_a]:hover:text-primary [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-ring" aria-label="Điều hướng chi tiết trận"><Link to="/matchmaking/matches">← Các trận của tôi</Link><span>/</span><span>Trận #{matchId}</span></nav>
    {loading && !data && <div className="flex flex-col gap-4" role="status"><Skeleton className="h-64 rounded-panel" /><Skeleton className="h-80 rounded-2xl" /><span className="text-sm text-muted-foreground">Đang tải chi tiết trận...</span></div>}
    {error && !data && <StateBlock title="Không thể xem trận" description={error.message} actionLabel="Thử lại" onAction={refresh} />}
    {error && data && <div className="flex flex-col items-start gap-3 rounded-lg bg-danger-bg p-4 text-sm text-danger" role="alert"><p>Chưa cập nhật được trạng thái mới nhất. Thông tin bên dưới có thể đã thay đổi.</p><Button variant="outline" className="h-11" onClick={refresh}>Tải lại trạng thái</Button></div>}
    {data && <>
      <MatchHero match={data} />
      {data.status === 'CANCELLED' && <div className="flex flex-col gap-2 rounded-2xl border border-danger/20 bg-danger-bg p-5 text-sm text-danger" role="status"><strong>Trận đấu đã bị hủy</strong><p>{cancellationReasons[data.cancellationReason ?? ''] ?? 'Trận đã bị hủy.'}</p><p>Không có đánh giá sau trận cho trận đã hủy.</p></div>}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"><div className="flex min-w-0 flex-col gap-6"><MatchSchedule match={data} /><MatchTeams match={data} /></div>
        <aside className="flex min-w-0 flex-col gap-6"><MatchActions match={data} stale={Boolean(error)} onLeave={() => setLeaving(data)} /><MatchCost match={data} /></aside>
      </div>
    </>}
    {leaving && <LeaveMatchDialog canSubmit={Boolean(data && !error && ['PENDING_COURT', 'CONFIRMED'].includes(data.status))} match={leaving} onClose={() => setLeaving(null)} onComplete={() => { setLeaving(null); refresh(); }} onConflict={refresh} />}
  </PageContainer>;
}

export function MatchDetailPage() {
  const { matchId } = useParams();
  const id = Number(matchId);
  if (!Number.isSafeInteger(id) || id <= 0) return <PageContainer className="max-w-320"><StateBlock title="Không tìm thấy trận đấu" description="Mã trận không hợp lệ." /><Link to="/matchmaking/matches">← Các trận của tôi</Link></PageContainer>;
  return <MatchDetailView key={id} matchId={id} />;
}
