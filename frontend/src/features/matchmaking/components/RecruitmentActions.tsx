import { type SetStateAction, type Dispatch, useId, useRef, useState, type ReactNode, type RefObject, type ReactPortal, type ReactElement, type JSXElementConstructor } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, MapPin, MessageCircle, Plus, Swords } from 'lucide-react';
import { Tabs } from 'radix-ui';
import { cn } from '@/shared/utils/cn';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useReturnFocus } from '@/shared/hooks/use-return-focus';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import { useVisibilityRefresh } from '../../../shared/hooks/useVisibilityRefresh';
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

type Court = { name: string; city: string; district: string; address: string };

function Block({ title, children }: { title?: string; children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-4">{title && <h3 className="text-base font-bold tracking-tight">{title}</h3>}{children}</div>;
}

function CourtDialog({ court, setCourt, busy, error, onClose, onSave }: { court: Court; setCourt: (update: (current: Court) => Court) => void; busy: boolean; error: string; onClose: () => void; onSave: () => void }) {
  const id = useId(); const returnFocus = useReturnFocus();
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent closeDisabled={busy} aria-describedby={undefined} onCloseAutoFocus={returnFocus}>
      <DialogTitle className="mb-5">Khai báo sân chơi</DialogTitle>
      <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); onSave(); }}>
        <fieldset disabled={busy} className="grid min-w-0 grid-cols-1 gap-3 disabled:opacity-75 sm:grid-cols-2">{(['name', 'city', 'district', 'address'] as const).map(key => <div key={key} className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-${key}`} className="text-xs font-semibold text-muted-foreground">{{ name: 'Tên sân', city: 'Tỉnh / thành phố', district: 'Quận / huyện', address: 'Địa chỉ' }[key]}</Label>
          <Input id={`${id}-${key}`} className="h-11 rounded-lg bg-card px-3 text-sm motion-safe:focus-visible:translate-y-0" required maxLength={key === 'address' ? 500 : 100} value={court[key]} onChange={e => setCourt(current => ({ ...current, [key]: e.target.value }))} />
        </div>)}</fieldset>
        <small className="text-xs text-muted-foreground">Thông tin sân do bạn cung cấp, chưa được xác minh.</small>
        {error && <Notice error>{error}</Notice>}
        <Button className="h-11 self-end" disabled={busy}>Lưu sân chơi</Button>
      </form>
    </DialogContent>
  </Dialog>;
}

export function RecruitmentActions({ requestId, published, skills, onChanged, overview }: { overview?: ReactNode; requestId: number; published?: boolean; skills: SkillLevel[]; onChanged: () => void }) {
  const navigate = useNavigate();
  const resource = useApiResource<{ data: RecruitmentDetail }>(`/api/v1/matchmaking-requests/${requestId}`);
  useVisibilityRefresh(resource.reload);
  const detail = resource.error ? undefined : resource.data?.data;
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const pending = useRef(false);
  const [confirmation, setConfirmation] = useState<'withdraw' | 'cancel' | 'close' | null>(null);
  const [removing, setRemoving] = useState<{ playerId: number; displayName: string } | null>(null);
  const [fieldsLocked, setFieldsLocked] = useState(false);
  const inviteButton = useRef<HTMLButtonElement>(null);
  const [candidatesOpen, setCandidatesOpen] = useState(false);
  const [peopleTab, setPeopleTab] = useState('members');
  const peopleId = useId();
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
  const { filled, progressStyle, canClose } = recruitmentCapacityState(detail);
  const tabClass = 'relative min-h-12 shrink-0 border-b-2 border-transparent px-1 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:text-primary';
  return <section aria-label="Tham gia và quản lý kèo" className={cn('grid min-w-0 items-start gap-6', overview && 'lg:grid-cols-[minmax(0,1fr)_19rem]')}>
    <RecruitmentPeople
  overview={overview}
  detail={detail}
  active={active}
  filled={filled}
  inviteButton={inviteButton}
  setCandidatesOpen={setCandidatesOpen}
  peopleTab={peopleTab}
  setPeopleTab={setPeopleTab}
  tabClass={tabClass}
  busy={busy}
  setError={setError}
  setRemoving={setRemoving}
  requestId={requestId}
  resource={resource}
  invitations={invitations}
  onChanged={onChanged}
  act={act}
/>
    <aside className={cn('flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6', overview && 'order-first lg:order-none lg:sticky lg:top-24')} aria-label="Tóm tắt và hành động kèo">
      <h2 className="text-lg font-bold tracking-tight">{detail?.access === 'HOST' ? 'Quản lý kèo' : 'Tham gia kèo'}</h2>
      {resource.loading && <p role="status" className="text-sm text-muted-foreground">Đang tải kèo…</p>}
      {resource.error && <Notice error>{resource.error}<Button type="button" variant="outline" className="h-11" onClick={resource.reload}>Thử tải lại kèo</Button></Notice>}
      {detail && <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {renderRecruitmentStatus(beforeStart, detail)}
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><CalendarClock aria-hidden="true" className="size-4 text-primary" />{playTime(detail.startAt, detail.durationMinutes)}</span>
      </div>
      {typeof detail.acceptedCount === 'number' && <div className="flex flex-col gap-2">
        <p className="flex items-baseline gap-1.5"><strong className="text-4xl font-bold tracking-tight">{filled}</strong><span className="text-sm text-muted-foreground">/ {detail.capacity} chỗ</span></p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`${filled} trên ${detail.capacity} chỗ`}><div className="h-full rounded-full bg-primary" style={progressStyle} /></div>
        {renderRecruitmentCapacity(detail)}
      </div>}
      {detail.status === 'OPEN' && filled >= detail.capacity && <Notice>Đã đủ người chơi, đang chờ chủ kèo chốt danh sách.</Notice>}
      {!overview && detail.externalCourt && <div className="flex gap-2.5 rounded-lg bg-muted/60 p-4"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><div className="flex min-w-0 flex-col gap-1"><h3 className="text-sm font-bold">{detail.externalCourt.name}</h3><p className="text-sm">{detail.externalCourt.address} · {detail.externalCourt.district}, {detail.externalCourt.city}</p><small className="text-xs text-muted-foreground">Thông tin sân do chủ kèo cung cấp, chưa được xác minh.</small></div></div>}
      {detail.cancellationReason && <Notice warning>{{ NO_COURT: 'Kèo đã hủy vì chưa có sân khi đến giờ chơi.', INSUFFICIENT_PLAYERS: 'Kèo đã hủy vì không đủ người. Booking vẫn được giữ nguyên.', HOST_CANCELLED: 'Chủ kèo đã hủy kèo.', HOST_LEFT: 'Chủ kèo đã rời kèo.', AUTHOR_DELETED: 'Bài viết đã được tác giả xóa.' }[detail.cancellationReason] ?? 'Kèo đã đóng.'}</Notice>}
      {detail.matchId && <Button asChild variant="info-soft" className="h-11 self-start"><Link to={`/matchmaking/matches/${detail.matchId}`}><Swords aria-hidden="true" />Xem trận đấu</Link></Button>}
      {detail.access === 'HOST' && (detail.conversationId || detail.status === 'MATCHED') && <div className="flex flex-col items-start gap-2">
        {detail.conversationId ? <Button asChild className="h-11"><Link to={`/messages/${detail.conversationId}`}><MessageCircle aria-hidden="true" />Mở nhóm chat</Link></Button> : <>
          <Button type="button" className="h-11" disabled={busy} onClick={() => void act(async () => {
            const result = await recruitmentApi.createGroupChat(requestId);
            navigate(`/messages/${result.data.conversationId}`);
          })}><MessageCircle aria-hidden="true" />{busy ? 'Đang xử lý…' : 'Tạo nhóm chat'}</Button>
          <small className="text-xs text-muted-foreground">Nhóm gồm chủ kèo và tất cả người chơi đã xác nhận. Người đi cùng không có tài khoản không được thêm vào nhóm.</small>
        </>}
      </div>}

      {detail.access === 'HOST' && active && <HostRecruitmentActions
  published={published}
  detail={detail}
  busy={busy}
  act={act}
  requestId={requestId}
  canClose={canClose}
  setConfirmation={setConfirmation}
  filled={filled}
  setEditing={setEditing}
  setCourtOpen={setCourtOpen}
/>}
      {detail.access === 'MEMBER' && active && <Button type="button" variant="caution-soft" className="h-11 self-start" disabled={busy} onClick={() => setConfirmation('withdraw')}>Rút khỏi kèo</Button>}
      {(detail.access === 'INVITEE' || detail.access === 'PUBLIC') && detail.invitationId && active && <><Notice>Lời mời không giữ chỗ. Chấp nhận mới xác nhận tham gia.</Notice><div className="flex flex-wrap gap-2"><Button type="button" className="h-11" disabled={busy} onClick={() => void act(() => matchmakingService.respondInvitation(detail.invitationId!, 'ACCEPTED'))}>Chấp nhận lời mời</Button><Button type="button" variant="caution-soft" className="h-11" disabled={busy} onClick={() => void act(() => matchmakingService.respondInvitation(detail.invitationId!, 'DECLINED'))}>Từ chối lời mời</Button></div></>}
      {detail.access === 'PUBLIC' && !detail.invitationId && <div className="border-t border-border pt-4"><ApplicationPanel requestId={requestId} canApply={active && detail.status === 'OPEN' && filled < detail.capacity} onChanged={() => { resource.reload(); onChanged(); }} /></div>}
      </>}
    {notice && <Notice>{notice}</Notice>}{error && !confirmation && !removing && !courtOpen && !editing && <Notice error>{error}</Notice>}
    {removing && <ConfirmDialog title="Loại người chơi khỏi kèo?" busy={busy} error={error} tone="danger" confirmLabel="Loại khỏi kèo" busyLabel="Đang xử lý…" onCancel={() => setRemoving(null)} onConfirm={() => void act(() => recruitmentApi.removeMember(requestId, removing.playerId))}
      description={<><p>Bạn muốn loại {removing.displayName} khỏi danh sách? Người chơi sẽ nhận thông báo.</p><p>{detail?.status === 'MATCHED' ? detail.matchType === 'GROUP' ? 'Kèo sẽ mở tuyển lại để tìm người thay thế, giữ trận hiện tại.' : 'Kèo đơn/đôi đã chốt sẽ bị hủy cùng trận đấu. Booking nếu có sẽ được đưa vào xử lý hủy.' : 'Chỗ của người chơi sẽ được giải phóng để nhận người khác.'}</p></>} />}
    {confirmation && <RecruitmentConfirmation
  confirmation={confirmation}
  busy={busy}
  error={error}
  setConfirmation={setConfirmation}
  act={act}
  requestId={requestId}
  detail={detail}
/>}
    {courtOpen && <CourtDialog court={court} setCourt={setCourt} busy={busy} error={error} onClose={() => setCourtOpen(false)} onSave={() => void act(() => recruitmentApi.court(requestId, court))} />}
    {editing && detail && <RecruitmentEdit detail={detail} fieldsLocked={fieldsLocked || (detail.acceptedCount ?? 0) > 0} skills={skills} busy={busy} error={error} onClose={() => setEditing(false)} onSave={changes => void act(() => recruitmentApi.edit(requestId, changes))} />}
    </aside>
    <Dialog open={candidatesOpen && detail?.access === 'HOST' && active && detail.status === 'OPEN' && filled < detail.capacity} onOpenChange={setCandidatesOpen}>
      <DialogContent variant="side" onCloseAutoFocus={event => { event.preventDefault(); inviteButton.current?.focus(); }} aria-describedby={`${peopleId}-candidates-description`}>
        <DialogTitle>Mời người chơi</DialogTitle>
        <p id={`${peopleId}-candidates-description`} className="mb-6 mt-2 text-sm text-muted-foreground">Tìm và mời người chơi phù hợp với kèo. Lời mời không giữ chỗ.</p>
        <CandidateList requestId={requestId} onInvited={() => { invitations.reload(); onChanged(); }} />
      </DialogContent>
    </Dialog>
  </section>;
}

function renderRecruitmentStatus(beforeStart: boolean, detail: RecruitmentDetail) {
  return <Badge variant="success">{!beforeStart && detail.status === 'OPEN' ? 'Đã ngừng tuyển' : recruitmentStatusLabels[detail.status] ?? detail.status}</Badge>;
}

function recruitmentCapacityState(detail: RecruitmentDetail | undefined) {
  const filled = detail ? 1 + detail.companionCount + (detail.acceptedCount ?? 0) : 0;
  const canClose = !!detail && (detail.matchType === 'GROUP' ? filled >= detail.minPlayers && (detail.acceptedCount ?? 0) >= 1 : filled >= detail.capacity);
  const progressStyle = { width: `${Math.min(100, detail ? filled / detail.capacity * 100 : 0)}%` };
  return { filled, progressStyle, canClose };
}

function renderRecruitmentCapacity(detail: RecruitmentDetail) {
  return <p className="text-xs text-muted-foreground">Bao gồm chủ kèo{detail.companionCount ? ` và ${detail.companionCount} người đi cùng` : ''}{detail.matchType === 'GROUP' ? ` · Tối thiểu ${detail.minPlayers} để chốt` : ''}.</p>;
}

type HostRecruitmentActionsProps = {
  published: boolean | undefined;
  detail: RecruitmentDetail;
  busy: boolean;
  act: (command: () => Promise<unknown>) => Promise<void>;
  requestId: number;
  canClose: boolean;
  setConfirmation: Dispatch<SetStateAction<"close" | "withdraw" | "cancel" | null>>;
  filled: number;
  setEditing: Dispatch<SetStateAction<boolean>>;
  setCourtOpen: Dispatch<SetStateAction<boolean>>;
};

function HostRecruitmentActions({
  published,
  detail,
  busy,
  act,
  requestId,
  canClose,
  setConfirmation,
  filled,
  setEditing,
  setCourtOpen,
}: HostRecruitmentActionsProps) {
  return <>
    {published === false && detail.status === 'OPEN' && <Button type="button" className="h-11" disabled={busy} onClick={() => void act(() => recruitmentApi.action(requestId, 'publish'))}>Công khai lên bảng tin</Button>}
    {detail.status === 'OPEN' && <Button type="button" className="h-12 w-full" disabled={busy || !canClose} onClick={() => setConfirmation('close')}>{detail.matchType === 'GROUP' && filled < detail.capacity ? 'Chốt kèo sớm' : 'Chốt kèo'}</Button>}
    {detail.status === 'OPEN' && !canClose && <p className="text-xs text-muted-foreground">Chưa đủ người để chốt kèo{detail.matchType === 'GROUP' ? `: cần tối thiểu ${detail.minPlayers} chỗ và một người chơi có tài khoản đã chấp nhận` : ''}.</p>}
    <details className="border-t border-border pt-3 text-xs text-muted-foreground">
      <summary className="min-h-9 cursor-pointer content-center rounded-md font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Tùy chọn quản lý & lưu ý</summary>
      <div className="mt-2 flex flex-col gap-2">
        {detail.status === 'OPEN' && <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => setEditing(true)}>Sửa thông tin kèo</Button>}
        {!detail.externalCourt && <Button type="button" variant="info-soft" className="h-11" disabled={busy} onClick={() => setCourtOpen(true)}>Thêm sân chơi</Button>}
        <Button type="button" variant="ghost" className="h-11 text-danger hover:bg-danger-bg" disabled={busy} onClick={() => setConfirmation('cancel')}>Hủy kèo</Button>
        <p className="leading-5">Giờ bắt đầu, loại kèo và sức chứa được khóa từ lần đầu có thành viên xác nhận, kể cả khi thành viên đó đã rút.</p>
        {detail.matchType === 'GROUP' && <p className="leading-5">Chốt kèo cần đủ tối thiểu {detail.minPlayers} chỗ và ít nhất một người chơi có tài khoản đã chấp nhận.</p>}
      </div>
    </details>
  </>;
}

type RecruitmentPeopleProps = {
  overview: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined;
  detail: RecruitmentDetail | undefined;
  active: boolean;
  filled: number;
  inviteButton: RefObject<HTMLButtonElement | null>;
  setCandidatesOpen: Dispatch<SetStateAction<boolean>>;
  peopleTab: string;
  setPeopleTab: Dispatch<SetStateAction<string>>;
  tabClass: string;
  busy: boolean;
  setError: Dispatch<SetStateAction<string>>;
  setRemoving: Dispatch<SetStateAction<{ playerId: number; displayName: string; } | null>>;
  requestId: number;
  resource: { data: { data: RecruitmentDetail; } | undefined; error: string | undefined; loading: boolean; reload: () => void; };
  invitations: { data: Paginated<Invitation> | undefined; error: string | undefined; loading: boolean; reload: () => void; };
  onChanged: () => void;
  act: (command: () => Promise<unknown>) => Promise<void>;
};

function RecruitmentPeople({
  overview,
  detail,
  active,
  filled,
  inviteButton,
  setCandidatesOpen,
  peopleTab,
  setPeopleTab,
  tabClass,
  busy,
  setError,
  setRemoving,
  requestId,
  resource,
  invitations,
  onChanged,
  act,
}: RecruitmentPeopleProps) {
  return <div className="flex min-w-0 flex-col gap-5">
    {overview}
    {detail && (detail.members || detail.access === 'HOST') && <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Người chơi và lời mời">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <div><h2 className="text-lg font-bold tracking-tight">{detail.access === 'HOST' ? 'Người chơi & lời mời' : 'Người chơi đã xác nhận'}</h2><p className="mt-1 text-xs text-muted-foreground">{detail.access === 'HOST' ? 'Quản lý thành viên, yêu cầu tham gia và lời mời theo từng mục.' : 'Danh sách người chơi trong buổi giao lưu.'}</p></div>
        {detail.access === 'HOST' && active && detail.status === 'OPEN' && filled < detail.capacity && <Button type="button" variant="outline" className="h-11" ref={inviteButton} onClick={() => setCandidatesOpen(true)}><Plus aria-hidden="true" />Mời người chơi</Button>}
      </div>
      <Tabs.Root value={detail.access === 'HOST' ? peopleTab : 'members'} onValueChange={setPeopleTab}>
        <Tabs.List aria-label="Quản lý người chơi" className="mt-3 flex gap-5 overflow-x-auto border-b border-border px-5 sm:px-6">
          <Tabs.Trigger value="members" className={tabClass}>Đã xác nhận{detail.members ? ` · ${detail.members.length}` : ''}</Tabs.Trigger>
          {detail.access === 'HOST' && <><Tabs.Trigger value="applications" className={tabClass}>Yêu cầu tham gia</Tabs.Trigger><Tabs.Trigger value="invitations" className={tabClass}>Lời mời đã gửi</Tabs.Trigger></>}
        </Tabs.List>
        <Tabs.Content value="members" className="min-w-0 p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-6">
          {detail.members && <div><ul className="flex flex-col">{detail.members.map(member => <li key={member.playerId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border py-2 last:border-b-0">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3"><PlayerProfileButton playerId={member.playerId} displayName={member.displayName} showAvatar /><small className="text-xs text-muted-foreground">{member.isOwner ? 'Chủ kèo' : member.skill?.name ?? 'Thành viên'}</small></div>
            {detail.access === 'HOST' && active && !member.isOwner && <Button type="button" variant="danger-soft" className="h-11" disabled={busy} onClick={() => { setError(''); setRemoving({ playerId: member.playerId, displayName: member.displayName ?? 'Người chơi' }); }}>Loại khỏi kèo</Button>}
          </li>)}</ul></div>}
          {!detail.members?.length && <p className="text-sm text-muted-foreground">Chưa có người chơi được xác nhận.</p>}
          {detail.companionCount > 0 && <p className="mt-3 text-xs text-muted-foreground">Có thêm {detail.companionCount} người đi cùng không có tài khoản, đã tính trong tổng số chỗ.</p>}
        </Tabs.Content>
        {detail.access === 'HOST' && <>
          <Tabs.Content value="applications" className="min-w-0 p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-6">
            <div><ApplicationPanel requestId={requestId} host canDecide={active && detail.status === 'OPEN'} onChanged={() => { resource.reload(); invitations.reload(); onChanged(); }} /></div>
          </Tabs.Content>
          <Tabs.Content value="invitations" className="min-w-0 p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-6">
            <Block title="Lời mời đang chờ">{invitations.loading && <p role="status" className="text-sm text-muted-foreground">Đang tải lời mời…</p>}{invitations.error && <Notice error>{invitations.error}<Button type="button" variant="outline" className="h-11" onClick={invitations.reload}>Tải lại lời mời</Button></Notice>}
              {invitations.data?.data.filter(invitation => invitation.requestId === requestId).map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-2"><PlayerProfileButton playerId={invitation.counterpart.playerId} displayName={invitation.counterpart.displayName} /><Button type="button" variant="caution-soft" className="h-11" disabled={busy || !active} onClick={() => void act(() => matchmakingService.cancelInvitation(invitation.id))}>Hủy lời mời</Button></div>)}
              {invitations.data && !invitations.data.data.some(invitation => invitation.requestId === requestId) && <p className="text-sm text-muted-foreground">Chưa có lời mời đang chờ trong trang này.</p>}
              <Link className="inline-flex min-h-11 items-center self-start rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to="/matchmaking/activity?section=created#invitations">Xem tất cả lời mời</Link>
            </Block>
          </Tabs.Content>
        </>}
      </Tabs.Root>
    </section>}
  </div>;
}

type RecruitmentConfirmationProps = {
  confirmation: 'close' | 'cancel' | 'withdraw';
  busy: boolean;
  error: string;
  setConfirmation: Dispatch<SetStateAction<"close" | "withdraw" | "cancel" | null>>;
  act: (command: () => Promise<unknown>) => Promise<void>;
  requestId: number;
  detail: RecruitmentDetail | undefined;
};

function RecruitmentConfirmation({
  confirmation,
  busy,
  error,
  setConfirmation,
  act,
  requestId,
  detail,
}: RecruitmentConfirmationProps): ReactNode {
  return <ConfirmDialog title={confirmation === 'cancel' ? 'Hủy kèo?' : confirmation === 'withdraw' ? 'Rút khỏi kèo?' : 'Chốt danh sách người chơi?'} busy={busy} error={error}
    tone={confirmation === 'cancel' ? 'danger' : confirmation === 'withdraw' ? 'caution-soft' : 'success-soft'} confirmLabel="Xác nhận" busyLabel="Đang xử lý…" onCancel={() => setConfirmation(null)} onConfirm={() => void act(() => recruitmentApi.action(requestId, confirmation))}
    description={confirmation === 'cancel' ? 'Kèo và các lời mời đang chờ sẽ đóng. Thành viên được thông báo. Nếu kèo đã chia tiền sân, booking sẽ bị hủy và hoàn tiền cho tất cả thành viên; booking chưa chia tiền được giữ nguyên.' : confirmation === 'withdraw' ? detail?.matchType === 'GROUP' ? 'Bạn sẽ không còn giữ chỗ. Kèo giao lưu sẽ kiểm tra lại số người tối thiểu và có thể mở tuyển lại.' : 'Rút khỏi kèo đơn hoặc đôi sẽ hủy trận đã hình thành. Bạn sẽ không còn giữ chỗ.' : 'Danh sách được chốt và trận đấu được tạo. Kèo ngừng nhận thêm người; các yêu cầu đang chờ sẽ đóng.'} />;
}
