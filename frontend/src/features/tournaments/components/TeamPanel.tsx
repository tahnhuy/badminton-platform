import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Crown, Link2, LoaderCircle, LogOut, Mail, Search, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { cn } from '@/shared/utils/cn';
import { feeLabel, formatDateTime } from '../format';
import { useMyTeam, useTournamentMutation } from '../queries';
import { tournamentApi } from '../tournament-api';
import type { Team, TeamInvitation, TournamentDetail } from '../types';
import { Notice, PlayerAvatar } from './shared';
import { RegisterDialog } from './RegisterDialog';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Doubles team panel on the tournament page (PRD FR-20…23, TRN-09). */
export function TeamPanel({ tournament: t, meId }: { tournament: TournamentDetail; meId: number | null }) {
  const open = t.status === 'OPEN_FOR_REGISTRATION';
  const mine = useMyTeam(t.id, t.matchType === 'DOUBLES' && meId !== null && !t.viewer.isOrganizer);
  if (t.matchType !== 'DOUBLES' || meId === null || t.viewer.isOrganizer) return null;
  const team = mine.data?.team ?? null;
  if (!open && !team) return null;

  return <section id="team-panel" className="scroll-mt-24 rounded-2xl border border-brand-mint bg-card p-5 shadow-panel sm:p-6">
    <div className="flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-full bg-brand-light text-brand-forest"><Users aria-hidden="true" className="size-5" /></span>
      <div><h2 className="text-lg font-bold tracking-tight">Đội của bạn</h2><p className="text-xs text-muted-foreground">Giải đôi: mỗi đội 2 người, đội trưởng đăng ký và trả lệ phí.</p></div>
    </div>
    {mine.isPending ? <Skeleton className="mt-4 h-32 rounded-2xl" />
      : <AnimatePresence mode="wait" initial={false}>
        <m.div key={team ? `${team.id}-${team.status}` : 'none'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: EASE }} className="mt-4">
          {team ? <TeamView tournament={t} team={team} meId={meId} /> : <NoTeam tournament={t} invitations={mine.data?.invitations ?? []} />}
        </m.div>
      </AnimatePresence>}
  </section>;
}

function NoTeam({ tournament: t, invitations }: { tournament: TournamentDetail; invitations: TeamInvitation[] }) {
  const [name, setName] = useState('');
  const create = useTournamentMutation(t.id, (value: string) => tournamentApi.createTeam(t.id, value), 'Đã lập đội — giờ mời đồng đội nhé!');
  const respond = useTournamentMutation(t.id, ({ id, action }: { id: number; action: 'accept' | 'decline' }) => tournamentApi.respondInvitation(id, action));
  const valid = name.trim().length >= 2;
  return <div className="grid gap-4">
    {invitations.length > 0 && <ul className="grid gap-2" aria-label="Lời mời vào đội">
      {invitations.map(inv => <li key={inv.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-brand-light p-3">
        <Mail aria-hidden="true" className="size-5 text-brand-forest" />
        <p className="min-w-0 flex-1 text-sm"><b>{inv.inviter.fullName}</b> mời bạn vào đội <b>{inv.team.name}</b><span className="block text-xs text-muted-foreground">Hết hạn {formatDateTime(inv.expiresAt)}</span></p>
        <Button type="button" variant="ghost" className="h-10" disabled={respond.isPending} onClick={() => respond.mutate({ id: inv.id, action: 'decline' })}>Từ chối</Button>
        <Button type="button" variant="brand" className="h-10" disabled={respond.isPending} onClick={() => respond.mutate({ id: inv.id, action: 'accept' })}><Check aria-hidden="true" />Nhận lời</Button>
      </li>)}
    </ul>}
    <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={e => { e.preventDefault(); if (valid) create.mutate(name.trim()); }}>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="team-name">Tên đội</Label>
        <Input id="team-name" className="h-11" maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="Ví dụ: Song Kiếm Hợp Bích" />
      </div>
      <Button type="submit" variant="brand" className="h-11" disabled={!valid || create.isPending}>
        {create.isPending ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : <UserPlus aria-hidden="true" />}Lập đội
      </Button>
    </form>
    <p className="text-xs text-muted-foreground">Bạn làm đội trưởng. Sau đó tìm đồng đội theo tên hoặc gửi link mời.</p>
  </div>;
}

function TeamView({ tournament: t, team, meId }: { tournament: TournamentDetail; team: Team; meId: number }) {
  const reduce = useReducedMotion();
  const captain = team.captainId === meId;
  const [confirm, setConfirm] = useState<null | 'leave' | 'remove'>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const leave = useTournamentMutation(t.id, () => tournamentApi.leaveTeam(t.id, team.id), r => (r.disbanded ? 'Đã giải tán đội.' : 'Bạn đã rời đội.'));
  const partner = team.members.find(x => x.role === 'MEMBER');
  const remove = useTournamentMutation(t.id, () => tournamentApi.removeMember(t.id, team.id, partner!.id), 'Đã mời đồng đội rời đội.');
  const register = useTournamentMutation(t.id, () => tournamentApi.register(t.id, team.id), 'Đội đã đăng ký — chúc hai bạn thi đấu tốt!');
  const open = t.status === 'OPEN_FOR_REGISTRATION';
  const locked = team.status === 'REGISTERED';

  return <div className="grid gap-4">
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-xl font-extrabold tracking-tight text-brand-forest">{team.name}</p>
      <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', locked ? 'bg-success-bg text-success' : team.status === 'FULL' ? 'bg-info-bg text-info' : 'bg-caution-bg text-caution')}>
        {locked ? 'Đã đăng ký' : team.status === 'FULL' ? 'Đủ 2 người' : 'Đang tìm đồng đội'}</span>
    </div>
    <ul className="grid gap-2 sm:grid-cols-2">
      {[0, 1].map(i => {
        const member = team.members[i];
        return <m.li key={member?.id ?? `empty-${i}`} layout={!reduce} initial={reduce ? false : { opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: EASE }}
          className={cn('flex items-center gap-3 rounded-2xl border p-3', member ? 'border-border bg-background' : 'border-dashed border-brand-mint')}>
          {member ? <>
            <PlayerAvatar player={member} />
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{member.fullName}{member.id === meId && <span className="text-muted-foreground"> (bạn)</span>}</p>
              <p className="text-xs text-muted-foreground">{member.role === 'CAPTAIN' ? 'Đội trưởng' : 'Thành viên'} · {member.skillLevel?.name ?? '—'}</p></div>
            {member.role === 'CAPTAIN' && <Crown aria-label="Đội trưởng" className="size-4 text-medal-gold" />}
            {captain && member.role === 'MEMBER' && !locked && open && <Button type="button" variant="ghost" className="h-9 px-2" aria-label={`Mời ${member.fullName} rời đội`} onClick={() => setConfirm('remove')}><UserMinus aria-hidden="true" /></Button>}
          </> : <p className="flex items-center gap-2 text-sm text-muted-foreground"><span className="grid size-10 place-items-center rounded-full bg-brand-light"><UserPlus aria-hidden="true" className="size-4 text-brand-forest" /></span>Chờ đồng đội</p>}
        </m.li>;
      })}
    </ul>

    {captain && team.status === 'FORMING' && open && <InviteTools tournament={t} team={team} />}
    {!captain && team.status === 'FULL' && <Notice tone="info">Đang chờ đội trưởng đăng ký và trả lệ phí.</Notice>}
    {locked && <Notice tone="success" icon={Check}>Đội đã đăng ký. Thành viên bị khoá; {captain ? 'bạn' : 'đội trưởng'} có thể rút đăng ký trước hạn.</Notice>}

    {open && !locked && <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
      <Button type="button" variant="danger-soft" className="h-11" onClick={() => setConfirm('leave')}><LogOut aria-hidden="true" />{captain ? 'Giải tán đội' : 'Rời đội'}</Button>
      {captain && <Button type="button" variant="brand" className="h-11" disabled={team.status !== 'FULL'} onClick={() => setRegisterOpen(true)}>Đăng ký đội · {feeLabel(t.entryFee)}</Button>}
    </div>}

    {confirm === 'leave' && <ConfirmDialog title={captain ? 'Giải tán đội?' : 'Rời đội?'} tone="danger" confirmLabel={captain ? 'Giải tán' : 'Rời đội'} busy={leave.isPending}
      description={<p>{captain ? 'Đồng đội và lời mời đang chờ sẽ bị huỷ. Cả hai có thể lập hoặc vào đội khác.' : 'Đội trở lại trạng thái tìm đồng đội.'}</p>}
      onCancel={() => setConfirm(null)} onConfirm={() => leave.mutate(undefined, { onSettled: () => setConfirm(null) })} />}
    {confirm === 'remove' && partner && <ConfirmDialog title={`Mời ${partner.fullName} rời đội?`} tone="danger" confirmLabel="Xác nhận" busy={remove.isPending}
      description={<p>Đội trở lại trạng thái tìm đồng đội.</p>} onCancel={() => setConfirm(null)} onConfirm={() => remove.mutate(undefined, { onSettled: () => setConfirm(null) })} />}
    <RegisterDialog tournament={t} open={registerOpen} onOpenChange={setRegisterOpen} busy={register.isPending}
      onConfirm={() => register.mutate(undefined, { onSuccess: () => setRegisterOpen(false) })} />
  </div>;
}

function InviteTools({ tournament: t, team }: { tournament: TournamentDetail; team: Team }) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(id); }, [search]);
  const results = useQuery({ queryKey: ['tournaments', t.id, 'invitable', q], queryFn: () => tournamentApi.invitable(t.id, q), enabled: q.length >= 2 });
  const invite = useTournamentMutation(t.id, (inviteeId: number) => tournamentApi.invite(t.id, team.id, inviteeId), r => `Đã gửi lời mời tới ${r.invitee.fullName}.`);
  const cancel = useTournamentMutation(t.id, (id: number) => tournamentApi.respondInvitation(id, 'cancel'), 'Đã huỷ lời mời.');
  const makeLink = useTournamentMutation(t.id, () => tournamentApi.inviteLink(t.id, team.id));
  const pending = team.pendingInvitation;

  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); toast.success('Đã sao chép link mời.'); } catch { toast.info('Sao chép thủ công: chọn link và bấm Ctrl+C.'); }
  };
  const generate = () => makeLink.mutate(undefined, { onSuccess: r => { const url = `${window.location.origin}${r.path}`; setLink(url); void copy(url); } });

  return <div className="grid gap-4 rounded-2xl bg-soft p-4">
    {pending ? <div className="flex flex-wrap items-center gap-3">
      <PlayerAvatar player={pending.invitee} size="sm" />
      <p className="min-w-0 flex-1 text-sm">Đã mời <b>{pending.invitee.fullName}</b><span className="block text-xs text-muted-foreground">Chờ trả lời tới {formatDateTime(pending.expiresAt)}</span></p>
      <Button type="button" variant="ghost" className="h-10" disabled={cancel.isPending} onClick={() => cancel.mutate(pending.id)}><X aria-hidden="true" />Huỷ lời mời</Button>
    </div> : <div className="flex flex-col gap-1.5">
      <Label htmlFor="invite-search">Tìm đồng đội theo tên</Label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id="invite-search" type="search" className="h-11 pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nhập ít nhất 2 ký tự" />
      </div>
      {q.length >= 2 && <ul className="mt-1 grid gap-1" aria-label="Kết quả tìm kiếm">
        {results.isPending ? <Skeleton className="h-12 rounded-lg" />
          : (results.data ?? []).length === 0 ? <li className="px-1 py-2 text-sm text-muted-foreground">Không tìm thấy người chơi phù hợp (đúng trình độ, chưa có đội).</li>
            : results.data!.map(p => <li key={p.id} className="flex items-center gap-3 rounded-lg bg-card px-3 py-2">
              <PlayerAvatar player={p} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.fullName}<span className="ml-1.5 font-normal text-muted-foreground">· {p.skillLevel.name}</span></span>
              <Button type="button" variant="outline" className="h-9" disabled={invite.isPending} onClick={() => invite.mutate(p.id, { onSuccess: () => setSearch('') })}>Mời</Button>
            </li>)}
      </ul>}
    </div>}
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <p className="text-sm font-semibold">Hoặc gửi link mời</p>
      {link ? <div className="flex gap-2"><Input readOnly value={link} aria-label="Link mời" className="h-10 text-xs" onFocus={e => e.currentTarget.select()} />
        <Button type="button" variant="outline" className="h-10" onClick={() => copy(link)} aria-label="Sao chép link"><Copy aria-hidden="true" /></Button></div> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="h-10" disabled={makeLink.isPending} onClick={generate}>
          <Link2 aria-hidden="true" />{team.hasInviteLink || link ? 'Tạo link mới' : 'Tạo link mời'}</Button>
        {(team.hasInviteLink || link) && <span className="text-xs text-muted-foreground">Tạo link mới sẽ vô hiệu link cũ.</span>}
      </div>
    </div>
  </div>;
}
