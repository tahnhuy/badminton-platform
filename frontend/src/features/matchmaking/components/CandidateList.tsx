import { useCallback, useEffect, useId, useState } from 'react';
import { Search, TriangleAlert, UserRoundX } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerProfileButton } from '../../player/profile/PlayerProfileButton';
import { ApiError } from '../../../shared/api/http-client';
import { matchmakingService } from '../services/matchmakingService';
import type { Candidate } from '../types/matchmaking';
import { errorMessage } from '../utils/status';

interface CandidateListProps {
  requestId: number;
  onInvited: () => void;
}

const PAGE_SIZE = 9;

export function CandidateList({ requestId, onInvited }: CandidateListProps) {
  const [search, setSearch] = useState('');
  const [includeOutOfRange, setIncludeOutOfRange] = useState(false);
  const [page, setPage] = useState(1);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState<Record<number, 'sent' | 'error'>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const searchId = useId();

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const response = await matchmakingService.browseCandidates(requestId, {
        search: search || undefined,
        includeOutOfRange,
        page,
        limit: PAGE_SIZE,
      });
      setCandidates(response.data);
      setTotalPages(response.meta.totalPages || 1);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Không thể tải danh sách người chơi.');
    }
  }, [requestId, search, includeOutOfRange, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (candidate: Candidate) => {
    setFeedback(null);
    try {
      await matchmakingService.sendInvitation(requestId, candidate.playerId);
      setInvited((prev) => ({ ...prev, [candidate.playerId]: 'sent' }));
      onInvited();
    } catch (err) {
      setInvited((prev) => ({ ...prev, [candidate.playerId]: 'error' }));
      setFeedback(err instanceof ApiError ? errorMessage(err.code, err.message) : 'Không thể gửi lời mời.');
    }
  };

  return <div className="flex min-w-0 flex-col gap-4">
    <h3 className="text-base font-bold tracking-tight">Mời người chơi</h3>
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor={searchId} className="sr-only">Tìm theo tên người chơi</Label>
        <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id={searchId} type="search" className="h-11 bg-card pl-9 text-sm motion-safe:focus-visible:translate-y-0" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo tên người chơi" /></div></div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="size-4.5 shrink-0 accent-primary" checked={includeOutOfRange} onChange={e => { setIncludeOutOfRange(e.target.checked); setPage(1); }} />Hiện cả người ngoài khoảng trình độ</label>
    </div>
    {feedback && <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{feedback}</p>}
    {status === 'loading' && <div role="status" className="flex flex-col gap-2"><span className="text-sm text-muted-foreground">Đang tìm người chơi phù hợp.</span><Skeleton className="h-24 rounded-2xl" /></div>}
    {status === 'error' && error && <EmptyState role="alert" icon={UserRoundX} title="Không tải được danh sách" description={error} action={{ label: 'Thử lại', onClick: () => void load() }} />}
    {status === 'success' && candidates.length === 0 && <EmptyState icon={UserRoundX} title="Không có người chơi phù hợp" description="Thử đổi từ khoá tìm kiếm hoặc bật hiển thị ngoài khoảng trình độ." />}
    {status === 'success' && candidates.length > 0 && <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {candidates.map(candidate => {
        const inviteState = invited[candidate.playerId];
        return <li key={candidate.playerId} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <PlayerProfileButton playerId={candidate.playerId} displayName={candidate.displayName} showAvatar />
          <span className="-mt-1 pl-13 text-xs text-muted-foreground">{candidate.skill?.name ?? 'Chưa xác định trình độ'}</span>
          {candidate.skillMismatch && <span className="flex items-center gap-1.5 text-xs font-semibold text-caution"><TriangleAlert aria-hidden="true" className="size-3.5" />Ngoài khoảng trình độ mong muốn</span>}
          <Button type="button" variant={inviteState === 'sent' ? 'outline' : 'default'} className="mt-1 h-11" onClick={() => void invite(candidate)} disabled={inviteState === 'sent'}>{inviteState === 'sent' ? 'Đã gửi lời mời' : 'Gửi lời mời'}</Button>
        </li>;
      })}
    </ul>}
    <Pagination page={page} totalPages={totalPages} onPageChange={next => setPage(p => (next > p ? Math.min(totalPages, p + 1) : Math.max(1, p - 1)))} />
  </div>;
}
