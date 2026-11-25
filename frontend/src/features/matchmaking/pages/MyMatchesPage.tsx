import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Swords } from 'lucide-react';
import { motion } from 'motion/react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePollingResource } from '../hooks/usePollingResource';
import { matchmakingService } from '../services/matchmakingService';
import { activityLabel } from '../../../shared/utils/activity-label';
import { StateBlock } from '../components/StateBlocks';
import { StatusPill } from '../components/MatchStatus';
import { useRatingPending } from '../../ratings/hooks/useRatingPending';
import { ratingErrorMessage } from '../../ratings/utils/messages';
import { RatingModal } from '../../ratings/components/RatingModal';
function RatingEntry({ matchId, onOpen }: { matchId: number; onOpen: () => void }) {
  const pending = useRatingPending(matchId, true);
  if (pending.loading) return <p>Đang tải đánh giá...</p>;
  if (pending.error) return <div role="alert">{ratingErrorMessage(pending.error)} <Button variant="outline" className="h-11" onClick={pending.refresh}>Thử tải lại đánh giá</Button></div>;
  if (!pending.data) return null;
  return <div className="mt-4 flex flex-wrap items-center gap-3"><Button className="h-11" type="button" onClick={onOpen}>{pending.data.pendingPlayers.length ? 'Đánh giá người chơi' : 'Xem đánh giá đã gửi'}</Button><span className="text-xs text-muted-foreground">{pending.data.pendingPlayers.length ? `Còn ${pending.data.pendingPlayers.length} người chưa đánh giá` : 'Đã gửi cho tất cả người chơi'}</span></div>;
}

export function MyMatchesPage() {
  const [ratingVersion, setRatingVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [ratingMatchId, setRatingMatchId] = useState<number | null>(null);
  const load = useCallback(() => matchmakingService.listMatches(page), [page]);
  const { data, loading, error, refresh } = usePollingResource(load);
  const ratingMatch = data?.data.find(match => match.id === ratingMatchId);
  return <PageContainer className="max-w-300">
    <Button asChild variant="ghost" className="h-11 self-start"><Link to="/matchmaking"><ArrowLeft aria-hidden="true" />Ghép trận</Link></Button>
    <PageHeader title="Các trận của tôi" description="Xem lại trận đấu và gửi đánh giá cho những người đã cùng bạn ra sân." />
    {loading && <div role="status" className="flex flex-col gap-4"><span className="text-sm text-muted-foreground">Đang tải...</span><Skeleton className="h-36 rounded-2xl" /><Skeleton className="h-36 rounded-2xl" /></div>}
    {error && <StateBlock title="Không tải được trận" description={error.message} actionLabel="Thử lại" onAction={refresh} />}
    {data?.data.length === 0 && <p>Chưa có trận nào.</p>}
    <ul className="grid gap-4">{data?.data.map(match => {
      const typeLabel = match.matchType === 'GROUP' ? 'Giao lưu' : match.matchType === 'SINGLES' ? 'Đơn' : 'Đôi';
      const label = activityLabel(match.hostName, { startAt: match.scheduledAt, durationMinutes: match.durationMinutes });
      return <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="group min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6" key={match.id}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <Link className="flex min-h-11 items-center gap-3 rounded-md text-base font-bold tracking-tight hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/matchmaking/matches/${match.id}`}><span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-success-bg text-primary"><Swords aria-hidden="true" className="size-5" /></span>{label}<ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></Link>
            <StatusPill status={match.status} />
          </div>
        </div>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">{typeLabel}</p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"><span className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-4 shrink-0" />{new Date(match.scheduledAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span><span className="flex items-center gap-2"><MapPin aria-hidden="true" className="size-4 shrink-0" />{match.facility?.name ?? 'Chưa có sân'}</span></div>
        {match.status === 'COMPLETED' && (
          <RatingEntry key={`${match.id}:${ratingVersion}`} matchId={match.id} onOpen={() => setRatingMatchId(match.id)} />
        )}
      </motion.li>;
    })}</ul>
    {data && data.meta.totalPages > 1 && <nav className="flex items-center justify-end gap-4 text-sm" aria-label="Trang trận đấu">
      <Button variant="outline" className="h-11" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Trước</Button>
      <span> {page}/{data.meta.totalPages} </span>
      <Button variant="outline" className="h-11" disabled={page >= data.meta.totalPages} onClick={() => setPage(value => value + 1)}>Sau</Button>
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
  </PageContainer>;
}
