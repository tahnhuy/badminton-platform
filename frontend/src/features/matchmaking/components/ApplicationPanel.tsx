import { useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/http-client';
import { Link } from 'react-router-dom';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import { useVisibilityRefresh } from '../../../shared/hooks/useVisibilityRefresh';
import { Dialog } from '../../../components/common/Dialog';
import { FilterToolbar } from '../../../components/common/FilterToolbar';
import { PlayerProfileButton } from '../../player/profile/PlayerProfileButton';
import { Notice } from '../../social/components/SocialUi';
import { dateTime, matchTypeLabels, socialError } from '../../social/utils';
import { applicationApi } from '../services/application-api';
import type { Application, ApplicationStatus } from '../types/application';
import type { Paginated } from '../types/matchmaking';

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
  return <section className="social-stack" aria-label={host ? 'Yêu cầu tham gia kèo' : requestId ? 'Yêu cầu tham gia của bạn' : 'Lịch sử xin tham gia'}>
    <h3>{host ? 'Yêu cầu tham gia' : requestId ? 'Yêu cầu tham gia của bạn' : 'Yêu cầu đã gửi'}</h3>
    {(host || !requestId) && <div className="social-application-filters"><FilterToolbar filters={[{ id: 'application-status', value: status, placeholder: 'Tất cả trạng thái', ariaLabel: 'Trạng thái yêu cầu', options: Object.entries(labels).map(([value, label]) => ({ value, label })), onChange: value => { setStatus(value); setPage(1); } }]} /></div>}
    {resource.loading && <p role="status">Đang tải yêu cầu tham gia…</p>}
    {resource.error && <Notice error>{resource.error}<button className="social-button" onClick={resource.reload}>Tải lại yêu cầu tham gia</button></Notice>}
    {rows.map(row => <div className="social-application-row social-stack" key={row.id}>
      {host ? <><PlayerProfileButton playerId={row.applicant.playerId} displayName={row.applicant.displayName} /><small>{row.applicant.skill?.name ?? 'Chưa rõ trình độ'} · Gửi {dateTime(row.createdAt)}</small></> : <Link className="social-text-button" to={`/posts/${row.request.postId}`}>{matchTypeLabels[row.request.matchType]} · Kèo #{row.requestId}</Link>}
      {row.applicant.skillMismatch && <Notice warning>{host ? 'Ngoài khoảng trình độ của kèo. Bạn vẫn có thể duyệt người chơi này.' : 'Trình độ của bạn nằm ngoài khoảng của kèo. Chủ kèo vẫn có thể duyệt yêu cầu.'}</Notice>}
      <span className="social-badge">{labels[row.status]}</span>{row.status === 'PENDING' && <small>Hết hạn {dateTime(row.expiresAt)} · Yêu cầu chưa giữ chỗ.</small>}
      {!host && row.status === 'ACCEPTED' && <Link className="social-button social-info" to={`/matchmaking/requests/${row.requestId}`}>Xem kèo đã tham gia</Link>}
      {row.closeReason && <small>{row.closeReason === 'SCHEDULE_CONFLICT' ? 'Đã đóng do trùng lịch với kèo đã xác nhận.' : 'Yêu cầu tham gia đã đóng.'}</small>}
      {row.status === 'PENDING' && <div className="social-actions">{host ? <><button className="social-button social-success" disabled={busy || !canDecide} onClick={() => { setError(''); setConfirmation({ id: row.id, decision: 'ACCEPTED' }); }}>{row.applicant.skillMismatch ? 'Vẫn duyệt' : 'Duyệt yêu cầu'}</button><button className="social-button social-caution" disabled={busy || !canDecide} onClick={() => { setError(''); setConfirmation({ id: row.id, decision: 'DECLINED' }); }}>Từ chối yêu cầu</button></> : <button className="social-button social-caution" disabled={busy} onClick={() => { setError(''); setConfirmation({ id: row.id, decision: 'CANCELLED' }); }}>Hủy yêu cầu tham gia</button>}</div>}
    </div>)}
    {!resource.loading && !resource.error && !rows.length && <p>{host ? 'Chưa có yêu cầu tham gia phù hợp.' : 'Chưa có yêu cầu tham gia phù hợp.'}</p>}
    {!host && requestId && canApply && !viewerPending && <button className="social-button social-primary" disabled={busy || resource.loading || !!resource.error || !resource.data} onClick={() => void act(() => applicationApi.create(requestId), 'Đã gửi yêu cầu. Bạn chưa giữ chỗ cho đến khi chủ kèo duyệt.')} >{busy ? 'Đang gửi…' : 'Xin tham gia'}</button>}
    {resource.data && resource.data.meta.totalPages > 1 && <div className="social-actions"><button className="social-button" disabled={resource.loading || page <= 1} onClick={() => setPage(value => value - 1)}>Trang yêu cầu trước</button><span>Trang {page}/{resource.data.meta.totalPages}</span><button className="social-button" disabled={resource.loading || page >= resource.data.meta.totalPages} onClick={() => setPage(value => value + 1)}>Trang yêu cầu sau</button></div>}
    {notice && <Notice>{notice}</Notice>}{error && !confirmation && <Notice error>{error}</Notice>}
    {confirmation && <Dialog title={confirmation.decision === 'ACCEPTED' ? 'Duyệt người chơi?' : confirmation.decision === 'DECLINED' ? 'Từ chối yêu cầu?' : 'Hủy yêu cầu tham gia?'} onClose={() => { if (!busy) setConfirmation(null); }} busy={busy}><div className="social-stack"><p>{confirmation.decision === 'ACCEPTED' ? 'Người chơi sẽ giữ một chỗ sau khi được duyệt. Khi đủ người, chủ kèo cần bấm Chốt kèo để xác nhận danh sách; các yêu cầu trùng lịch của người chơi có thể đóng.' : confirmation.decision === 'DECLINED' ? 'Người chơi sẽ nhận kết quả từ chối yêu cầu này.' : 'Yêu cầu đang chờ của bạn sẽ đóng. Thao tác này không phải rút khỏi kèo đã được duyệt.'}</p>{error && <Notice error>{error}</Notice>}<div className="social-actions"><button className="social-button social-secondary" disabled={busy} onClick={() => setConfirmation(null)}>Quay lại</button><button className={`social-button ${confirmation.decision === 'ACCEPTED' ? 'social-success' : 'social-caution'}`} disabled={busy} onClick={() => void act(() => confirmation.decision === 'CANCELLED' ? applicationApi.cancel(confirmation.id) : applicationApi.decide(confirmation.id, confirmation.decision), confirmation.decision === 'ACCEPTED' ? 'Đã duyệt người chơi.' : confirmation.decision === 'DECLINED' ? 'Đã từ chối yêu cầu.' : 'Đã hủy yêu cầu tham gia.')}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</button></div></div></Dialog>}
  </section>;
}
