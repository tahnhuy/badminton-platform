import { Link } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '../../../shared/utils/formatDate';
import type { MatchmakingRequestSummary } from '../types/matchmaking';
import { activityLabel } from '../../../shared/utils/activity-label';
import { Countdown, StatusPill } from './MatchStatus';

interface RequestListCardProps {
  request: MatchmakingRequestSummary;
  onFindPlayers: (id: number) => void;
  onCancel: (id: number) => void;
  onWithdraw?: (id: number) => void;
  cancelling: boolean;
  withdrawing?: boolean;
}

const matchTypeLabel: Record<string, string> = { SINGLES: 'Đơn', DOUBLES: 'Đôi', GROUP: 'Giao lưu' };

export function RequestListCard({ request, onFindPlayers, onCancel, onWithdraw, cancelling, withdrawing = false }: RequestListCardProps) {
  const isOpen = request.status === 'OPEN';
  const type = matchTypeLabel[request.matchType] ?? request.matchType;
  const label = activityLabel(request.hostName, request);
  return <article aria-label={label} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2.5"><h2 className="text-lg font-bold tracking-tight wrap-anywhere">{label}</h2><StatusPill status={request.status} /></div>
      {isOpen && request.expiresAt && <span className="text-xs text-muted-foreground"><Countdown expiresAt={request.expiresAt} /></span>}
    </div>
    <p className="text-sm font-semibold text-muted-foreground">{type}</p>
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
      <li className="flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-4 text-primary" />{formatDate(request.preferredDate)}</li>
      <li className="flex items-center gap-1.5"><Clock aria-hidden="true" className="size-4 text-primary" />{request.preferredStartTime?.slice(0, 5) ?? '—'} - {request.preferredEndTime?.slice(0, 5) ?? '—'}</li>
      {request.area && <li className="flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-4 text-primary" />{request.area}</li>}
      {request.matchType !== 'GROUP' && <li className="flex items-center gap-1.5"><Users aria-hidden="true" className="size-4 text-primary" />{request.requiredPlayers - request.remainingCount}/{request.requiredPlayers} người</li>}
    </ul>
    <p className="rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
      {request.matchType === 'GROUP' ? 'Xem số chỗ và người đi cùng trong chi tiết kèo.' : <>Còn thiếu <strong className="text-foreground">{request.remainingCount}</strong> người để tạo trận.</>}
    </p>
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" className="h-11"><Link to={`/matchmaking/requests/${request.id}`}>Xem kèo</Link></Button>
      {isOpen && request.isOwner && <>
        <Button type="button" className="h-11" onClick={() => onFindPlayers(request.id)}>Tìm người</Button>
        <Button type="button" variant="ghost" className="h-11 text-danger hover:bg-danger-bg hover:text-danger" onClick={() => onCancel(request.id)} disabled={cancelling}>{cancelling ? 'Đang hủy...' : 'Hủy yêu cầu'}</Button>
      </>}
      {!request.isOwner && onWithdraw && <Button type="button" variant="ghost" className="h-11 text-danger hover:bg-danger-bg hover:text-danger" onClick={() => onWithdraw(request.id)} disabled={withdrawing}>{withdrawing ? 'Đang rút...' : 'Rút khỏi kèo'}</Button>}
      {request.status === 'MATCHED' && request.matchId && <Button asChild variant="outline" className="h-11"><Link to={`/matchmaking/matches/${request.matchId}`}>Xem trận</Link></Button>}
    </div>
  </article>;
}
