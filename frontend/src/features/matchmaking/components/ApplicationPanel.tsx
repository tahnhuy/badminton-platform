import { type SetStateAction, type Dispatch, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cn } from '@/shared/utils/cn';
import { ApiError } from '../../../shared/api/http-client';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import { useVisibilityRefresh } from '../../../shared/hooks/useVisibilityRefresh';
import { PlayerProfileButton } from '../../player/profile/PlayerProfileButton';
import { Notice } from '../../social/components/SocialUi';
import { dateTime, socialError } from '../../social/utils';
import { activityLabel } from '../../../shared/utils/activity-label';
import { applicationApi } from '../services/application-api';
import type { Application, ApplicationStatus } from '../types/application';
import type { Paginated } from '../types/matchmaking';

const tones: Partial<Record<ApplicationStatus, string>> = { PENDING: 'bg-caution-bg text-caution', ACCEPTED: 'bg-success-bg text-success', DECLINED: 'bg-danger-bg text-danger' };

const labels: Record<ApplicationStatus, string> = { PENDING: 'Chờ duyệt', ACCEPTED: 'Đã được duyệt', DECLINED: 'Đã từ chối', CANCELLED: 'Đã đóng', EXPIRED: 'Đã hết hạn', WITHDRAWN: 'Đã rút khỏi kèo' };
type Command = { id: number; decision: 'ACCEPTED' | 'DECLINED' | 'CANCELLED' };

/** One composition for host applicants, viewer pending state and the Player's history. */
export function ApplicationPanel({ requestId, host = false, canApply = false, canDecide = false, onChanged }: {
  requestId?: number; host?: boolean; canApply?: boolean; canDecide?: boolean; onChanged?: () => void;
}) {
  const [status, setStatus] = useState(host || requestId ? 'PENDING' : '');
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page), limit: '10', ...(status ? { status } : {}), ...(!host && requestId ? { requestId: String(requestId) } : {}) });
  const path = host ? `/api/v1/matchmaking-requests/${requestId}/applications?${query}` : `/api/v1/matchmaking-applications?${query}`;
  const resource = useApiResource<Paginated<Application>>(path); useVisibilityRefresh(resource.reload);
  const [busy, setBusy] = useState(false); const pending = useRef(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [confirmation, setConfirmation] = useState<Command | null>(null);
  const act = async (command: () => Promise<unknown>, message: string) => {
    if (pending.current) return; pending.current = true; setBusy(true); setError(''); setNotice('');
    try { await command(); setConfirmation(null); resource.reload(); onChanged?.(); setNotice(message); }
    catch (reason) { setError(reason instanceof ApiError && reason.statusCode >= 500 ? 'Chưa thể xử lý yêu cầu tham gia. Vui lòng thử lại sau.' : socialError(reason)); resource.reload(); onChanged?.(); }
    finally { pending.current = false; setBusy(false); }
  };
  const rows = resource.error ? [] : resource.data?.data ?? [];
  const viewerPending = rows.some(row => row.status === 'PENDING');
  const filterId = useId();
  return <section className="flex min-w-0 flex-col gap-4" aria-label={host ? 'Yêu cầu tham gia kèo' : requestId ? 'Yêu cầu tham gia của bạn' : 'Lịch sử xin tham gia'}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h3 className="text-base font-bold tracking-tight">{host ? 'Yêu cầu tham gia' : requestId ? 'Yêu cầu tham gia của bạn' : 'Yêu cầu đã gửi'}</h3>
      {(host || !requestId) && <div className="flex min-w-48 flex-col gap-1.5"><Label htmlFor={filterId} className="text-xs font-semibold text-muted-foreground">Trạng thái yêu cầu</Label>
        <Select id={filterId} value={status} onChange={value => { setStatus(value); setPage(1); }} options={[{ value: '', label: 'Tất cả trạng thái' }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))]} /></div>}
    </div>
    {resource.loading && <p role="status" className="text-sm text-muted-foreground">Đang tải yêu cầu tham gia…</p>}
    {resource.error && <Notice error>{resource.error}<Button type="button" variant="outline" className="h-11" onClick={resource.reload}>Tải lại yêu cầu tham gia</Button></Notice>}
    {!!rows.length && <ul className="flex flex-col">{rows.map(row => <li key={row.id} className="flex flex-col gap-2 border-b border-border py-4 first:pt-0 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {host ? <div className="flex min-w-0 flex-col"><PlayerProfileButton playerId={row.applicant.playerId} displayName={row.applicant.displayName} /><small className="-mt-2 text-xs text-muted-foreground">{row.applicant.skill?.name ?? 'Chưa rõ trình độ'} · Gửi {dateTime(row.createdAt)}</small></div>
          : <Link className="min-h-11 content-center rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/posts/${row.request.postId}`}>{activityLabel(row.request.hostName, row.request)}</Link>}
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', tones[row.status] ?? 'bg-muted text-muted-foreground')}>{labels[row.status]}</span>
      </div>
      {row.applicant.skillMismatch && <Notice warning><span className="flex gap-2"><TriangleAlert aria-hidden="true" className="mt-1 size-4 shrink-0 text-caution" />{host ? 'Ngoài khoảng trình độ của kèo. Bạn vẫn có thể duyệt người chơi này.' : 'Trình độ của bạn nằm ngoài khoảng của kèo. Chủ kèo vẫn có thể duyệt yêu cầu.'}</span></Notice>}
      {row.status === 'PENDING' && <small className="text-xs text-muted-foreground">Hết hạn {dateTime(row.expiresAt)} · Yêu cầu chưa giữ chỗ.</small>}
      {!host && row.status === 'ACCEPTED' && <Button asChild variant="info-soft" className="h-11 self-start"><Link to={`/matchmaking/requests/${row.requestId}`}>Xem kèo đã tham gia</Link></Button>}
      {row.closeReason && <small className="text-xs text-muted-foreground">{row.closeReason === 'SCHEDULE_CONFLICT' ? 'Đã đóng do trùng lịch với kèo đã xác nhận.' : 'Yêu cầu tham gia đã đóng.'}</small>}
      {row.status === 'PENDING' && <div className="flex flex-wrap gap-2">{host ? <>
        <Button type="button" variant="success-soft" className="h-11" disabled={busy || !canDecide} onClick={() => { setError(''); setConfirmation({ id: row.id, decision: 'ACCEPTED' }); }}>{row.applicant.skillMismatch ? 'Vẫn duyệt' : 'Duyệt yêu cầu'}</Button>
        <Button type="button" variant="caution-soft" className="h-11" disabled={busy || !canDecide} onClick={() => { setError(''); setConfirmation({ id: row.id, decision: 'DECLINED' }); }}>Từ chối yêu cầu</Button>
      </> : <Button type="button" variant="caution-soft" className="h-11" disabled={busy} onClick={() => { setError(''); setConfirmation({ id: row.id, decision: 'CANCELLED' }); }}>Hủy yêu cầu tham gia</Button>}</div>}
    </li>)}</ul>}
    {!resource.loading && !resource.error && !rows.length && <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">{host ? 'Chưa có yêu cầu tham gia phù hợp.' : 'Chưa có yêu cầu tham gia phù hợp.'}</p>}
    {!host && requestId && canApply && !viewerPending && <Button type="button" className="h-11 self-start" disabled={busy || resource.loading || !!resource.error || !resource.data} onClick={() => void act(() => applicationApi.create(requestId), 'Đã gửi yêu cầu. Bạn chưa giữ chỗ cho đến khi chủ kèo duyệt.')}>{busy ? 'Đang gửi…' : 'Xin tham gia'}</Button>}
    {resource.data && resource.data.meta.totalPages > 1 && <div className="flex flex-wrap items-center justify-center gap-3">
      <Button type="button" variant="outline" className="h-11" disabled={resource.loading || page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft aria-hidden="true" />Trang yêu cầu trước</Button>
      <span className="text-sm text-muted-foreground">Trang {page}/{resource.data.meta.totalPages}</span>
      <Button type="button" variant="outline" className="h-11" disabled={resource.loading || page >= resource.data.meta.totalPages} onClick={() => setPage(value => value + 1)}>Trang yêu cầu sau<ChevronRight aria-hidden="true" /></Button>
    </div>}
    {notice && <Notice>{notice}</Notice>}{error && !confirmation && <Notice error>{error}</Notice>}
    {confirmation && <ApplicationConfirmation
  confirmation={confirmation}
  error={error}
  busy={busy}
  setConfirmation={setConfirmation}
  act={act}
/>}
  </section>;
}

type ApplicationConfirmationProps = {
  confirmation: Command;
  error: string;
  busy: boolean;
  setConfirmation: Dispatch<SetStateAction<Command | null>>;
  act: (command: () => Promise<unknown>, message: string) => Promise<void>;
};

function ApplicationConfirmation({
  confirmation,
  error,
  busy,
  setConfirmation,
  act,
}: ApplicationConfirmationProps): import("react").ReactNode {
  return <ConfirmDialog title={confirmation.decision === 'ACCEPTED' ? 'Duyệt người chơi?' : confirmation.decision === 'DECLINED' ? 'Từ chối yêu cầu?' : 'Hủy yêu cầu tham gia?'}
    description={confirmation.decision === 'ACCEPTED' ? 'Người chơi sẽ giữ một chỗ sau khi được duyệt. Khi đủ người, chủ kèo cần bấm Chốt kèo để xác nhận danh sách; các yêu cầu trùng lịch của người chơi có thể đóng.' : confirmation.decision === 'DECLINED' ? 'Người chơi sẽ nhận kết quả từ chối yêu cầu này.' : 'Yêu cầu đang chờ của bạn sẽ đóng. Thao tác này không phải rút khỏi kèo đã được duyệt.'}
    error={error} busy={busy} tone={confirmation.decision === 'ACCEPTED' ? 'success-soft' : 'caution-soft'} confirmLabel="Xác nhận" busyLabel="Đang xử lý…" onCancel={() => setConfirmation(null)}
    onConfirm={() => void act(() => confirmation.decision === 'CANCELLED' ? applicationApi.cancel(confirmation.id) : applicationApi.decide(confirmation.id, confirmation.decision), confirmation.decision === 'ACCEPTED' ? 'Đã duyệt người chơi.' : confirmation.decision === 'DECLINED' ? 'Đã từ chối yêu cầu.' : 'Đã hủy yêu cầu tham gia.')} />;
}
