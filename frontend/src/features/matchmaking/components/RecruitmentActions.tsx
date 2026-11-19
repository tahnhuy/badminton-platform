import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import { useVisibilityRefresh } from '../../../shared/hooks/useVisibilityRefresh';
import { Dialog } from '../../../components/common/Dialog';
import '../../social/social.css';
import { PlayerProfileButton } from '../../player/profile/PlayerProfileButton';
import { matchmakingService } from '../services/matchmakingService';
import { recruitmentApi } from '../services/recruitment-api';
import type { RecruitmentDetail } from '../types/recruitment';
import type { SkillLevel, Invitation, Paginated } from '../types/matchmaking';
import { Notice } from '../../social/components/SocialUi';
import { playTime, recruitmentStatusLabels, socialError } from '../../social/utils';
import { ApplicationPanel } from './ApplicationPanel';
import { CandidateList } from './CandidateList';
import { RecruitmentEdit } from './RecruitmentEdit';
import { ApiError } from '../../../shared/api/http-client';
import { useBeforeInstant } from '../../../shared/hooks/useBeforeInstant';

export function RecruitmentActions({ requestId, published, skills, onChanged }: { requestId: number; published?: boolean; skills: SkillLevel[]; onChanged: () => void }) {
  const navigate = useNavigate();
  const resource = useApiResource<{ data: RecruitmentDetail }>(`/api/v1/matchmaking-requests/${requestId}`);
  useVisibilityRefresh(resource.reload);
  const detail = resource.error ? undefined : resource.data?.data;
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const pending = useRef(false);
  const [confirmation, setConfirmation] = useState<'withdraw' | 'cancel' | 'close' | null>(null);
  const [removing, setRemoving] = useState<{ playerId: number; displayName: string } | null>(null);
  const [fieldsLocked, setFieldsLocked] = useState(false);
  const [editing, setEditing] = useState(false); const [courtOpen, setCourtOpen] = useState(false);
  const [court, setCourt] = useState({ name: '', city: '', district: '', address: '' });
  const invitations = useApiResource<Paginated<Invitation>>(detail?.access === 'HOST' ? '/api/v1/matchmaking-invitations?direction=SENT&status=PENDING&limit=50' : null);
  const act = async (command: () => Promise<unknown>) => {
    if (pending.current) return; pending.current = true; setBusy(true); setError(''); setNotice('');
    try { await command(); setConfirmation(null); setRemoving(null); setCourtOpen(false); setEditing(false); resource.reload(); invitations.reload(); onChanged(); setNotice('Đã cập nhật kèo.'); }
    catch (reason) { setError(socialError(reason)); if (reason instanceof ApiError && reason.code === 'MATCHMAKING_FIELD_LOCKED') setFieldsLocked(true); }
    finally { pending.current = false; setBusy(false); }
  };
  const beforeStart = useBeforeInstant(detail?.startAt);
  const active = !!detail && ['OPEN', 'MATCHED'].includes(detail.status) && beforeStart;
  const filled = detail ? 1 + detail.companionCount + (detail.acceptedCount ?? 0) : 0;
  const canClose = !!detail && (detail.matchType === 'GROUP' ? filled >= detail.minPlayers && (detail.acceptedCount ?? 0) >= 1 : filled >= detail.capacity);
  return <section className="social-card" aria-label="Tham gia và quản lý kèo"><h2>{detail?.access === 'HOST' ? 'Quản lý người tham gia' : 'Tham gia kèo'}</h2>
    {resource.loading && <p role="status">Đang tải kèo…</p>}{resource.error && <Notice error>{resource.error}<button className="social-button" onClick={resource.reload}>Thử tải lại kèo</button></Notice>}
    {detail && <>
      <span className="social-badge">{!beforeStart && detail.status === 'OPEN' ? 'Đã ngừng tuyển' : recruitmentStatusLabels[detail.status] ?? detail.status}</span><p>{playTime(detail.startAt, detail.durationMinutes)}</p>
      {typeof detail.acceptedCount === 'number' && <Notice><strong>{1 + detail.companionCount + detail.acceptedCount}/{detail.capacity} chỗ</strong><small>Bao gồm chủ kèo{detail.matchType === 'GROUP' ? ` và ${detail.companionCount} người đi cùng · Tối thiểu ${detail.minPlayers}` : ''}.</small></Notice>}
      {detail.status === 'OPEN' && filled >= detail.capacity && <Notice>Đã đủ người chơi, đang chờ chủ kèo chốt danh sách.</Notice>}
      {detail.externalCourt && <div className="social-stack"><h3>{detail.externalCourt.name}</h3><p>{detail.externalCourt.address} · {detail.externalCourt.district}, {detail.externalCourt.city}</p><small>Thông tin sân do chủ kèo cung cấp, chưa được xác minh.</small></div>}
      {detail.cancellationReason && <Notice>{{ NO_COURT: 'Kèo đã hủy vì chưa có sân khi đến giờ chơi.', INSUFFICIENT_PLAYERS: 'Kèo đã hủy vì không đủ người. Booking vẫn được giữ nguyên.', HOST_CANCELLED: 'Chủ kèo đã hủy kèo.', HOST_LEFT: 'Chủ kèo đã rời kèo.', AUTHOR_DELETED: 'Bài viết đã được tác giả xóa.' }[detail.cancellationReason] ?? 'Kèo đã đóng.'}</Notice>}
      {detail.matchId && <Link className="social-button social-info" to={`/matchmaking/matches/${detail.matchId}`}>Xem trận đấu</Link>}
      {detail.access === 'HOST' && (detail.conversationId || detail.status === 'MATCHED') && <div className="social-stack">
        {detail.conversationId ? <Link className="social-button social-primary" to={`/messages/${detail.conversationId}`}>Mở nhóm chat</Link> : <>
          <button className="social-button social-primary" disabled={busy} onClick={() => void act(async () => {
            const result = await recruitmentApi.createGroupChat(requestId);
            navigate(`/messages/${result.data.conversationId}`);
          })}>{busy ? 'Đang xử lý…' : 'Tạo nhóm chat'}</button>
          <small>Nhóm gồm chủ kèo và tất cả người chơi đã xác nhận. Người đi cùng không có tài khoản không được thêm vào nhóm.</small>
        </>}
      </div>}

      {detail.members && <div className="social-stack"><h3>Người chơi đã xác nhận</h3>{detail.members.map(member => <div className="recruitment-member" key={member.playerId}><PlayerProfileButton playerId={member.playerId} displayName={member.displayName} showAvatar /><small>{member.isOwner ? 'Chủ kèo' : member.skill?.name ?? 'Thành viên'}</small>{detail.access === 'HOST' && active && !member.isOwner && <button className="social-button social-danger" disabled={busy} onClick={() => { setError(''); setRemoving({ playerId: member.playerId, displayName: member.displayName ?? 'Người chơi' }); }}>Loại khỏi kèo</button>}</div>)}</div>}
      {detail.access === 'HOST' && active && <>
        <Notice>Giờ bắt đầu, loại kèo và sức chứa được khóa từ lần đầu có thành viên xác nhận, kể cả khi thành viên đó đã rút.</Notice>
        <div className="social-actions">{published === false && detail.status === 'OPEN' && <button className="social-button social-primary" disabled={busy} onClick={() => void act(() => recruitmentApi.action(requestId, 'publish'))}>Công khai lên bảng tin</button>}
          {detail.status === 'OPEN' && <button className="social-button social-secondary" disabled={busy} onClick={() => setEditing(true)}>Sửa thông tin kèo</button>}
          {!detail.externalCourt && <button className="social-button social-info" disabled={busy} onClick={() => setCourtOpen(true)}>Thêm sân chơi</button>}
          {detail.status === 'OPEN' && <button className="social-button social-success" disabled={busy || !canClose} onClick={() => setConfirmation('close')}>{detail.matchType === 'GROUP' && filled < detail.capacity ? 'Chốt kèo sớm' : 'Chốt kèo'}</button>}
          <button className="social-button social-danger" disabled={busy} onClick={() => setConfirmation('cancel')}>Hủy kèo</button>
        </div>
        {detail.matchType === 'GROUP' && <small>Chốt kèo cần đủ tối thiểu {detail.minPlayers} chỗ và ít nhất một người chơi có tài khoản đã chấp nhận.</small>}
        <h3>Lời mời đang chờ</h3>{invitations.loading && <p role="status">Đang tải lời mời…</p>}{invitations.error && <Notice error>{invitations.error}<button className="social-button" onClick={invitations.reload}>Tải lại lời mời</button></Notice>}
        {invitations.data?.data.filter(invitation => invitation.requestId === requestId).map(invitation => <div className="social-member" key={invitation.id}><PlayerProfileButton playerId={invitation.counterpart.playerId} displayName={invitation.counterpart.displayName} /><button className="social-button social-caution" disabled={busy} onClick={() => void act(() => matchmakingService.cancelInvitation(invitation.id))}>Hủy lời mời</button></div>)}
        {invitations.data && !invitations.data.data.some(invitation => invitation.requestId === requestId) && <p>Chưa có lời mời đang chờ trong trang này.</p>}<Link className="social-text-button" to="/matchmaking/invitations">Xem tất cả lời mời</Link>
        {detail.status === 'OPEN' && filled < detail.capacity && <CandidateList requestId={requestId} onInvited={() => { invitations.reload(); onChanged(); }} />}
      </>}
      {detail.access === 'HOST' && <ApplicationPanel requestId={requestId} host canDecide={active && detail.status === 'OPEN'} onChanged={() => { resource.reload(); invitations.reload(); onChanged(); }} />}
      {detail.access === 'MEMBER' && active && <button className="social-button social-caution" disabled={busy} onClick={() => setConfirmation('withdraw')}>Rút khỏi kèo</button>}
      {(detail.access === 'INVITEE' || detail.access === 'PUBLIC') && detail.invitationId && active && <><Notice>Lời mời không giữ chỗ. Chấp nhận mới xác nhận tham gia.</Notice><div className="social-actions"><button className="social-button social-success" disabled={busy} onClick={() => void act(() => matchmakingService.respondInvitation(detail.invitationId!, 'ACCEPTED'))}>Chấp nhận lời mời</button><button className="social-button social-caution" disabled={busy} onClick={() => void act(() => matchmakingService.respondInvitation(detail.invitationId!, 'DECLINED'))}>Từ chối lời mời</button></div></>}
      {detail.access === 'PUBLIC' && !detail.invitationId && <ApplicationPanel requestId={requestId} canApply={active && detail.status === 'OPEN' && filled < detail.capacity} onChanged={() => { resource.reload(); onChanged(); }} />}
    </>}
    {notice && <Notice>{notice}</Notice>}{error && !confirmation && !removing && !courtOpen && !editing && <Notice error>{error}</Notice>}
    {removing && <Dialog title="Loại người chơi khỏi kèo?" busy={busy} onClose={() => { if (!busy) setRemoving(null); }}><div className="social-stack"><p>Bạn muốn loại {removing.displayName} khỏi danh sách? Người chơi sẽ nhận thông báo.</p><p>{detail?.status === 'MATCHED' ? detail.matchType === 'GROUP' ? 'Kèo sẽ mở tuyển lại để tìm người thay thế, giữ trận hiện tại.' : 'Kèo đơn/đôi đã chốt sẽ bị hủy cùng trận đấu. Booking nếu có sẽ được đưa vào xử lý hủy.' : 'Chỗ của người chơi sẽ được giải phóng để nhận người khác.'}</p>{error && <Notice error>{error}</Notice>}<div className="social-actions"><button className="social-button social-secondary" disabled={busy} onClick={() => setRemoving(null)}>Quay lại</button><button className="social-button social-danger-solid" disabled={busy} onClick={() => void act(() => recruitmentApi.removeMember(requestId, removing.playerId))}>{busy ? 'Đang xử lý…' : 'Loại khỏi kèo'}</button></div></div></Dialog>}
    {confirmation && <Dialog title={confirmation === 'cancel' ? 'Hủy kèo?' : confirmation === 'withdraw' ? 'Rút khỏi kèo?' : 'Chốt danh sách người chơi?'} busy={busy} onClose={() => setConfirmation(null)}><div className="social-stack"><p>{confirmation === 'cancel' ? 'Kèo và các lời mời đang chờ sẽ đóng. Thành viên được thông báo; booking được giữ nguyên.' : confirmation === 'withdraw' ? detail?.matchType === 'GROUP' ? 'Bạn sẽ không còn giữ chỗ. Kèo giao lưu sẽ kiểm tra lại số người tối thiểu và có thể mở tuyển lại.' : 'Rút khỏi kèo đơn hoặc đôi sẽ hủy trận đã hình thành. Bạn sẽ không còn giữ chỗ.' : 'Danh sách được chốt và trận đấu được tạo. Kèo ngừng nhận thêm người; các yêu cầu đang chờ sẽ đóng.'}</p>{error && <Notice error>{error}</Notice>}<div className="social-actions"><button className="social-button social-secondary" disabled={busy} onClick={() => setConfirmation(null)}>Quay lại</button><button className={`social-button ${confirmation === 'cancel' ? 'social-danger-solid' : confirmation === 'withdraw' ? 'social-caution' : 'social-success'}`} disabled={busy} onClick={() => void act(() => recruitmentApi.action(requestId, confirmation))}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</button></div></div></Dialog>}
    {courtOpen && <Dialog title="Khai báo sân chơi" busy={busy} onClose={() => setCourtOpen(false)}><form className="social-form" onSubmit={e => { e.preventDefault(); void act(() => recruitmentApi.court(requestId, court)); }}><fieldset disabled={busy}>{(['name', 'city', 'district', 'address'] as const).map(key => <label key={key}>{{ name: 'Tên sân', city: 'Tỉnh / thành phố', district: 'Quận / huyện', address: 'Địa chỉ' }[key]}<input required maxLength={key === 'address' ? 500 : 100} value={court[key]} onChange={e => setCourt(current => ({ ...current, [key]: e.target.value }))} /></label>)}</fieldset><small>Thông tin sân do bạn cung cấp, chưa được xác minh.</small>{error && <Notice error>{error}</Notice>}<button className="social-button social-primary" disabled={busy}>Lưu sân chơi</button></form></Dialog>}
    {editing && detail && <RecruitmentEdit detail={detail} fieldsLocked={fieldsLocked || (detail.acceptedCount ?? 0) > 0} skills={skills} busy={busy} error={error} onClose={() => setEditing(false)} onSave={changes => void act(() => recruitmentApi.edit(requestId, changes))} />}
  </section>;
}

