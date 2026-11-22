import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, Inbox, MapPin, SearchX, Send } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerProfileButton } from '../../player/profile/PlayerProfileButton';
import { usePollingResource } from '../hooks/usePollingResource';
import { ApiError } from '../../../shared/api/http-client';
import { formatDate } from '../../../shared/utils/formatDate';
import { matchmakingService } from '../services/matchmakingService';
import type { Invitation } from '../types/matchmaking';
import { errorMessage } from '../utils/status';
import { activityLabel } from '../utils/activity-label';
import { Countdown, StatusPill } from './MatchStatus';

interface InvitationListProps {
  direction: 'RECEIVED' | 'SENT';
  refreshToken: number;
  onChanged: () => void;
}

const PAGE_SIZE = 10;

export function InvitationList({ direction, refreshToken, onChanged }: InvitationListProps) {
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(() => {
    void refreshToken;
    return matchmakingService.listInvitations({ direction, page, limit: PAGE_SIZE });
  }, [direction, page, refreshToken]);
  const resource = usePollingResource(load);
  const invitations: Invitation[] = resource.data?.data ?? [];
  const totalPages = resource.data?.meta.totalPages || 1;
  const status = resource.loading ? 'loading' : resource.error ? 'error' : 'success';
  const error = resource.error?.message ?? null;

  const act = async (id: number, action: () => Promise<unknown>) => {
    setBusyId(id);
    setFeedback(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setFeedback(err instanceof ApiError ? errorMessage(err.code, err.message) : 'Thao tác thất bại.');
    } finally {
      setBusyId(null);
    }
  };

  return <div className="flex min-w-0 flex-col gap-4">
    {feedback && <p role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">{feedback}</p>}
    {status === 'loading' && <div role="status" className="flex flex-col gap-3"><span className="text-sm text-muted-foreground">Đang tải danh sách lời mời.</span><Skeleton className="h-36 rounded-2xl" /></div>}
    {status === 'error' && error && <EmptyState role="alert" icon={SearchX} title="Không tải được danh sách" description={error} action={{ label: 'Thử lại', onClick: resource.refresh }} />}
    {status === 'success' && invitations.length === 0 && <EmptyState icon={direction === 'RECEIVED' ? Inbox : Send}
      title={direction === 'RECEIVED' ? 'Chưa có lời mời nào' : 'Bạn chưa gửi lời mời nào'}
      description={direction === 'RECEIVED' ? 'Các lời mời tìm đối thủ sẽ xuất hiện ở đây.' : 'Hãy tạo yêu cầu và gửi lời mời tới người chơi phù hợp.'} />}
    {status === 'success' && invitations.map(invitation => <article key={invitation.id} aria-label={`Lời mời ${activityLabel(invitation.request.hostName, invitation.request)}`} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PlayerProfileButton playerId={invitation.counterpart.playerId} displayName={invitation.counterpart.displayName} />
        <StatusPill status={invitation.status} />
      </div>
      <h3 className="text-base font-bold wrap-anywhere">{activityLabel(invitation.request.hostName, invitation.request)}</h3>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <li className="font-semibold text-foreground">{invitation.request.matchType === 'GROUP' ? 'Giao lưu' : invitation.request.matchType === 'DOUBLES' ? 'Đôi' : 'Đơn'}</li>
        <li className="flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-4 text-primary" />{formatDate(invitation.request.preferredDate)}</li>
        <li className="flex items-center gap-1.5"><Clock aria-hidden="true" className="size-4 text-primary" />{invitation.request.preferredStartTime?.slice(0, 5) ?? '—'} - {invitation.request.preferredEndTime?.slice(0, 5) ?? '—'}</li>
        {invitation.request.area && <li className="flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-4 text-primary" />{invitation.request.area}</li>}
      </ul>
      {invitation.status === 'PENDING' && <span className="text-xs text-muted-foreground"><Countdown expiresAt={invitation.expiresAt} /></span>}
      <div className="flex flex-wrap gap-2">
        {invitation.status === 'ACCEPTED' && invitation.request.status === 'OPEN' && <Button asChild variant="outline" className="h-11"><Link to={`/matchmaking/requests/${invitation.requestId}`}>Xem nhóm</Link></Button>}
        {invitation.matchId && <Button asChild variant="info-soft" className="h-11"><Link to={`/matchmaking/matches/${invitation.matchId}`}>Xem trận</Link></Button>}
        {direction === 'RECEIVED' && invitation.status === 'PENDING' && <>
          <Button type="button" className="h-11" disabled={busyId === invitation.id} onClick={() => void act(invitation.id, () => matchmakingService.respondInvitation(invitation.id, 'ACCEPTED'))}>Chấp nhận</Button>
          <Button type="button" variant="danger-soft" className="h-11" disabled={busyId === invitation.id} onClick={() => void act(invitation.id, () => matchmakingService.respondInvitation(invitation.id, 'DECLINED'))}>Từ chối</Button>
        </>}
        {direction === 'RECEIVED' && invitation.status === 'ACCEPTED' && invitation.request.status === 'OPEN' && <Button type="button" variant="outline" className="h-11" disabled={busyId === invitation.id} onClick={() => void act(invitation.id, () => matchmakingService.withdrawInvitation(invitation.id))}>Rút khỏi nhóm</Button>}
        {direction === 'SENT' && invitation.status === 'PENDING' && <Button type="button" variant="outline" className="h-11" disabled={busyId === invitation.id} onClick={() => void act(invitation.id, () => matchmakingService.cancelInvitation(invitation.id))}>Thu hồi lời mời</Button>}
      </div>
    </article>)}
    <Pagination page={page} totalPages={totalPages} onPageChange={next => setPage(p => (next > p ? Math.min(totalPages, p + 1) : Math.max(1, p - 1)))} />
  </div>;
}
