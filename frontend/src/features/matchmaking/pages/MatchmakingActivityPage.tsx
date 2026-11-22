import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Plus, SearchX, Trophy } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { EmptyState } from '@/components/common/empty-state';
import { Pagination } from '@/components/common/pagination';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { ApiError } from '../../../shared/api/http-client';
import { usePollingResource } from '../hooks/usePollingResource';
import { matchmakingService } from '../services/matchmakingService';
import type { MatchmakingRequestSummary, SkillLevel } from '../types/matchmaking';
import type { PostCard } from '../../social/types';
import { ApplicationPanel } from '../components/ApplicationPanel';
import { InvitationList } from '../components/InvitationList';
import { PostComposer } from '../../social/components/PostComposer';
import { RequestListCard } from '../components/RequestListCard';
import { errorMessage } from '../utils/status';

type Section = 'joined' | 'created';

function Segmented({ value, onChange }: { value: Section; onChange: (value: Section) => void }) {
  return <div role="group" aria-label="Vai trò trong kèo" className="flex w-fit max-w-full flex-wrap gap-1 rounded-full bg-muted p-1">
    {([['joined', 'Kèo tham gia'], ['created', 'Kèo đã tạo']] as const).map(([key, text]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}
      className={cn('min-h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', value === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-card hover:text-foreground')}>{text}</button>)}
  </div>;
}

const PAGE_SIZE = 10;

function RequestSection({ role, refreshToken, onChanged }: { role: 'host' | 'member'; refreshToken: number; onChanged: () => void }) {
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ id: number; action: 'cancel' | 'withdraw' } | null>(null);
  const navigate = useNavigate();
  const load = useCallback(() => {
    void refreshToken;
    return matchmakingService.listRequests({ role, page, limit: PAGE_SIZE });
  }, [role, page, refreshToken]);
  const resource = usePollingResource(load);
  const requests: MatchmakingRequestSummary[] = resource.data?.data ?? [];
  const totalPages = resource.data?.meta.totalPages || 1;
  const status = resource.loading ? 'loading' : resource.error ? 'error' : 'success';
  const error = resource.error?.message ?? null;

  const act = async (id: number, action: 'cancel' | 'withdraw') => {
    setBusyId(id); setFeedback(null);
    try {
      if (action === 'cancel') await matchmakingService.cancelRequest(id);
      else await matchmakingService.withdrawRequest(id);
      setConfirmation(null); resource.refresh(); onChanged();
    } catch (err) {
      setFeedback(err instanceof ApiError ? errorMessage(err.code, err.message) : action === 'cancel' ? 'Không thể hủy yêu cầu.' : 'Không thể rút khỏi kèo.');
    } finally { setBusyId(null); }
  };

  return <section className="flex min-w-0 flex-col gap-4" aria-label={role === 'host' ? 'Kèo đã tạo' : 'Kèo tham gia'}>
    {feedback && <p role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">{feedback}</p>}
    {status === 'loading' && <div role="status" className="flex flex-col gap-3"><span className="text-sm text-muted-foreground">Đang tải kèo…</span><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-44 rounded-2xl" /></div>}
    {status === 'error' && error && <EmptyState role="alert" icon={SearchX} title="Không tải được danh sách" description={error} action={{ label: 'Thử lại', onClick: resource.refresh }} />}
    {status === 'success' && requests.length === 0 && <EmptyState icon={ClipboardList}
      title={role === 'host' ? 'Bạn chưa tạo kèo nào' : 'Bạn chưa tham gia kèo nào'}
      description={role === 'host' ? 'Đăng kèo để tìm người chơi cùng và quản lý tại đây.' : 'Các kèo bạn được nhận tham gia sẽ xuất hiện ở đây.'} />}
    {status === 'success' && requests.map(request => <RequestListCard key={request.id} request={request}
      onFindPlayers={id => navigate(`/matchmaking/requests/${id}`)}
      onCancel={id => { setFeedback(null); setConfirmation({ id, action: 'cancel' }); }}
      onWithdraw={role === 'member' && request.status !== 'CANCELLED' && request.status !== 'EXPIRED' ? id => { setFeedback(null); setConfirmation({ id, action: 'withdraw' }); } : undefined}
      cancelling={busyId === request.id && confirmation?.action === 'cancel'}
      withdrawing={busyId === request.id && confirmation?.action === 'withdraw'} />)}
    <Pagination page={page} totalPages={totalPages} disabled={resource.loading} onPageChange={next => setPage(next)} />
    {confirmation && <ConfirmDialog title={confirmation.action === 'cancel' ? 'Hủy kèo?' : 'Rút khỏi kèo?'}
      description={confirmation.action === 'cancel' ? 'Kèo sẽ đóng và người chơi bị ảnh hưởng được thông báo. Booking được giữ nguyên.' : 'Bạn sẽ rời khỏi danh sách người chơi của kèo này theo điều kiện hiện tại.'}
      error={feedback} busy={busyId !== null} tone="danger" confirmLabel={confirmation.action === 'cancel' ? 'Xác nhận hủy kèo' : 'Xác nhận rút'}
      onCancel={() => { setConfirmation(null); setFeedback(null); }} onConfirm={() => void act(confirmation.id, confirmation.action)} />}
  </section>;
}

export function MatchmakingActivityPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const section: Section = params.get('section') === 'created' ? 'created' : 'joined';
  const [skills, setSkills] = useState<SkillLevel[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => { matchmakingService.listSkillLevels().then(setSkills).catch(() => setSkills([])); }, []);
  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView({ block: 'start' });
  }, [location.hash, section]);

  const change = (next: Section) => setParams(next === 'joined' ? {} : { section: next });

  return <PageContainer className="max-w-250">
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Link to="/matchmaking" className="inline-flex min-h-9 items-center gap-1 rounded-md font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft aria-hidden="true" className="size-4" />Về tìm đối thủ</Link></div>
    <PageHeader title="Hoạt động của tôi" description="Việc cần xử lý, kèo sắp chơi và lịch sử tham gia." actions={<>
      <Button asChild variant="outline" className="h-11"><Link to="/matchmaking/matches"><Trophy aria-hidden="true" />Các trận của tôi</Link></Button>
      <Button type="button" className="h-11" onClick={() => setFormOpen(true)}><Plus aria-hidden="true" />Đăng kèo</Button>
    </>} />
    <Segmented value={section} onChange={change} />
    <div className="mt-2 flex flex-col gap-6">
      {section === 'joined' ? <>
        <div id="invitations" className="scroll-mt-24"><InvitationList key="RECEIVED" direction="RECEIVED" refreshToken={version} onChanged={() => { setVersion(v => v + 1); }} /></div>
        <div id="applications" className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><ApplicationPanel onChanged={() => setVersion(v => v + 1)} /></div>
        <RequestSection role="member" refreshToken={version} onChanged={() => setVersion(v => v + 1)} />
      </> : <>
        <RequestSection role="host" refreshToken={version} onChanged={() => setVersion(v => v + 1)} />
        <div id="invitations" className="scroll-mt-24"><InvitationList key="SENT" direction="SENT" refreshToken={version} onChanged={() => setVersion(v => v + 1)} /></div>
      </>}
    </div>
    {formOpen && <PostComposer type="MATCH_FINDING" skills={skills} onClose={() => setFormOpen(false)} onSaved={(post: PostCard) => { setFormOpen(false); navigate(`/posts/${post.id}`); }} />}
  </PageContainer>;
}
