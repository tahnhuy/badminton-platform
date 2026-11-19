import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, Plus, SearchX, Trophy } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { EmptyState } from '@/components/common/empty-state';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useReturnFocus } from '@/shared/hooks/use-return-focus';
import { cn } from '@/shared/utils/cn';
import { usePollingResource } from '../hooks/usePollingResource';
import { ApiError } from '../../../shared/api/http-client';
import { matchmakingService } from '../services/matchmakingService';
import type { MatchmakingRequestSummary, SkillLevel } from '../types/matchmaking';
import { ApplicationPanel } from '../components/ApplicationPanel';
import { InvitationList } from '../components/InvitationList';
import { PostComposer } from '../../social/components/PostComposer';
import { RequestListCard } from '../components/RequestListCard';
import { errorMessage } from '../utils/status';

function CancelRequestDialog({ busy, feedback, onKeep, onConfirm }: { busy: boolean; feedback: string | null; onKeep: () => void; onConfirm: () => void }) {
  const returnFocus = useReturnFocus();
  return <Dialog open onOpenChange={open => { if (!open && !busy) onKeep(); }}>
    <DialogContent onCloseAutoFocus={returnFocus}>
      <DialogTitle>Hủy kèo?</DialogTitle>
      <DialogDescription className="mt-3 leading-6">Kèo sẽ đóng và người chơi bị ảnh hưởng được thông báo. Booking được giữ nguyên.</DialogDescription>
      {feedback && <p role="alert" className="mt-4 rounded-lg bg-danger-bg p-3 text-sm text-danger">{feedback}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={onKeep}>Quay lại</Button>
        <Button type="button" className="h-11 bg-danger text-primary-foreground hover:bg-danger-hover" disabled={busy} onClick={onConfirm}>Xác nhận hủy kèo</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return <div role="group" aria-label={label} className="flex w-fit max-w-full flex-wrap gap-1 rounded-full bg-muted p-1">
    {options.map(([key, text]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}
      className={cn('min-h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', value === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-card hover:text-foreground')}>{text}</button>)}
  </div>;
}

const PAGE_SIZE = 10;

type Tab = 'requests' | 'invitations' | 'applications';

export function MatchmakingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'applications' ? 'applications' : searchParams.get('tab') === 'invitations' ? 'invitations' : 'requests';
  const [skillLevels, setSkillLevels] = useState<SkillLevel[]>([]);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [invitationDirection, setInvitationDirection] = useState<'RECEIVED' | 'SENT'>('RECEIVED');
  const [refreshToken, setRefreshToken] = useState(0);

  const [confirmCancel, setConfirmCancel] = useState<number | null>(null);

  const navigate = useNavigate();
  const loadRequests = useCallback(() => {
    void refreshToken;
    return matchmakingService.listRequests({ page, limit: PAGE_SIZE });
  }, [page, refreshToken]);
  const resource = usePollingResource(loadRequests, tab === 'requests');
  const requests: MatchmakingRequestSummary[] = resource.data?.data ?? [];
  const totalPages = resource.data?.meta.totalPages || 1;
  const status = resource.loading ? 'loading' : resource.error ? 'error' : 'success';
  const error = resource.error?.message ?? null;

  useEffect(() => {
    matchmakingService
      .listSkillLevels()
      .then(setSkillLevels)
      .catch(() => setSkillLevels([]));
  }, []);

  const cancelRequest = async (requestId: number) => {
    setCancellingId(requestId);
    setFeedback(null);
    try {
      await matchmakingService.cancelRequest(requestId);
      setRefreshToken((token) => token + 1);
      setConfirmCancel(null);
    } catch (err) {
      setFeedback(err instanceof ApiError ? errorMessage(err.code, err.message) : 'Không thể hủy yêu cầu.');
    } finally {
      setCancellingId(null);
    }
  };

  return <PageContainer className="max-w-275">
    <PageHeader title="Tìm đối thủ" description="Đăng kèo, mời người chơi phù hợp và quản lý lời mời của bạn." actions={<>
      <Button asChild variant="outline" className="h-11"><Link to="/matchmaking/matches"><Trophy aria-hidden="true" />Các trận của tôi</Link></Button>
      <Button type="button" className="h-11" onClick={() => setFormOpen(true)}><Plus aria-hidden="true" />Tạo yêu cầu</Button>
    </>} />
    <Segmented<Tab> label="Mục tìm đối thủ" value={tab} onChange={key => setSearchParams(key === 'requests' ? {} : { tab: key })}
      options={[['requests', 'Kèo của tôi'], ['invitations', 'Lời mời'], ['applications', 'Yêu cầu đã gửi']]} />

    {feedback && <p role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">{feedback}</p>}

    {tab === 'requests' && <div className="flex flex-col gap-4">
      {status === 'loading' && <div role="status" className="flex flex-col gap-3"><span className="text-sm text-muted-foreground">Đang tải...</span><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-44 rounded-2xl" /></div>}
      {status === 'error' && error && <EmptyState role="alert" icon={SearchX} title="Không tải được danh sách" description={error} action={{ label: 'Thử lại', onClick: resource.refresh }} />}
      {status === 'success' && requests.length === 0 && <EmptyState icon={ClipboardList} title="Chưa có yêu cầu ghép trận" description="Tạo yêu cầu để bắt đầu tìm đối thủ phù hợp." action={{ label: 'Tạo yêu cầu', onClick: () => setFormOpen(true) }} />}
      {status === 'success' && requests.map(request => <RequestListCard key={request.id} request={request}
        onFindPlayers={id => navigate(`/matchmaking/requests/${id}`)}
        onCancel={id => { setFeedback(null); setConfirmCancel(id); }}
        cancelling={cancellingId === request.id} />)}
      {/* Functional updates keep rapid clicks within bounds, as before. */}
      <Pagination page={page} totalPages={totalPages} onPageChange={next => setPage(p => (next > p ? Math.min(totalPages, p + 1) : Math.max(1, p - 1)))} />
    </div>}

    {tab === 'applications' && <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><ApplicationPanel /></section>}

    {tab === 'invitations' && <div className="flex flex-col gap-4">
      <Segmented<'RECEIVED' | 'SENT'> label="Hướng lời mời" value={invitationDirection} onChange={setInvitationDirection} options={[['RECEIVED', 'Đã nhận'], ['SENT', 'Đã gửi']]} />
      <InvitationList key={invitationDirection} direction={invitationDirection} refreshToken={refreshToken} onChanged={() => setRefreshToken(token => token + 1)} />
    </div>}

    {formOpen && <PostComposer type="MATCH_FINDING" skills={skillLevels} onClose={() => setFormOpen(false)} onSaved={post => { setFormOpen(false); navigate(`/posts/${post.id}`); }} />}
    {confirmCancel !== null && <CancelRequestDialog busy={cancellingId !== null} feedback={feedback} onKeep={() => setConfirmCancel(null)} onConfirm={() => void cancelRequest(confirmCancel)} />}
  </PageContainer>;
}
