import { useState } from 'react';
import { UserMinus, Users } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { feeLabel, formatDateTime, unitLabel } from '../format';
import { useParticipants, useTournamentMutation } from '../queries';
import { tournamentApi } from '../tournament-api';
import type { Participant, TournamentDetail } from '../types';
import { Notice, Panel, PlayerAvatar, SeedBadge } from '../components/shared';

/** Participants with Organizer removal before the draw (PRD FR-13). */
export function ParticipantsAdmin({ tournament: t }: { tournament: TournamentDetail }) {
  const reduce = useReducedMotion();
  const list = useParticipants(t.id);
  const [target, setTarget] = useState<Participant | null>(null);
  const [reason, setReason] = useState('');
  const remove = useTournamentMutation(t.id, ({ registrationId, why }: { registrationId: number; why: string }) => tournamentApi.remove(t.id, registrationId, why),
    r => (r.refundedAt ? 'Đã loại và hoàn lệ phí về ví người chơi.' : 'Đã loại người tham gia.'));
  const canRemove = t.status === 'OPEN_FOR_REGISTRATION' || t.status === 'REGISTRATION_CLOSED';
  const close = () => { setTarget(null); setReason(''); };

  return <Panel title={`Người tham gia (${t.confirmedCount}/${t.participantLimit} ${unitLabel(t.matchType)})`}>
    {!canRemove && t.status !== 'DRAFT' && <Notice tone="info" className="mb-4">Đã bốc thăm — không thể loại thêm người. Vắng mặt xử lý bằng walkover ở mục Trận đấu.</Notice>}
    {list.isPending ? <div className="grid gap-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      : (list.data ?? []).length === 0 ? <EmptyState icon={Users} title="Chưa có người đăng ký" description="Mở đăng ký để người chơi tham gia." />
        : <ul className="divide-y divide-border">
          <AnimatePresence initial={false}>
            {(list.data ?? []).map(p => <m.li key={p.registrationId} layout={!reduce} exit={reduce ? undefined : { opacity: 0, x: 24 }} className="flex items-center gap-3 py-3">
              <SeedBadge seed={p.seedNo} />
              <div className="flex -space-x-2">{p.players.map(player => <PlayerAvatar key={player.id} player={player} />)}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.teamName ?? p.players.map(player => player.fullName).join(' / ')}</p>
                <p className="truncate text-xs text-muted-foreground">{p.players.map(player => player.skillLevel?.name ?? '—').join(' · ')} · đăng ký {formatDateTime(p.registeredAt)}</p>
              </div>
              {canRemove && <Button type="button" variant="danger-soft" className="h-9 px-3" onClick={() => setTarget(p)}><UserMinus aria-hidden="true" />Loại</Button>}
            </m.li>)}
          </AnimatePresence>
        </ul>}
    {target && <ConfirmDialog title={`Loại ${target.teamName ?? target.players.map(p => p.fullName).join(' / ')}?`} tone="danger"
      confirmLabel="Loại và hoàn tiền" busyLabel="Đang xử lý…" busy={remove.isPending}
      description={<p>{t.entryFee > 0 ? <>Người chơi được hoàn <b>{feeLabel(t.entryFee)}</b> về ví và </> : 'Người chơi '}nhận thông báo kèm lý do.</p>}
      onCancel={close} onConfirm={() => { if (reason.trim()) remove.mutate({ registrationId: target.registrationId, why: reason.trim() }, { onSettled: close }); }}>
      <div className="mt-4 flex flex-col gap-1.5">
        <Label htmlFor="remove-reason">Lý do (bắt buộc)</Label>
        <Input id="remove-reason" className="h-11" maxLength={300} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ví dụ: Sai thông tin trình độ" aria-invalid={!reason.trim()} />
        {!reason.trim() && <p className="text-xs text-muted-foreground">Nhập lý do để xác nhận.</p>}
      </div>
    </ConfirmDialog>}
  </Panel>;
}
