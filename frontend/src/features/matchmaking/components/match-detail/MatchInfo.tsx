import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, Copy, MapPin, Receipt, Swords, Users } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { PlayerProfileButton } from '../../../player/profile/PlayerProfileButton';
import { useAuth } from '../../../auth/auth-context';
import type { MatchDetail } from '../../types/matchmaking';
import { StatusPill } from '../MatchStatus';
import { matchDate, matchTimeRange, matchStatusDescriptions } from '../../utils/matchDetail';

export function MatchHero({ match }: { match: MatchDetail }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(`#${match.id}`); setCopied('Đã sao chép mã trận.'); }
    catch { setCopied('Không thể sao chép. Bạn có thể chọn mã trận để sao chép thủ công.'); }
  };
  return <header className="relative isolate overflow-hidden rounded-panel bg-primary bg-linear-to-br from-primary to-brand-hover p-6 text-primary-foreground shadow-panel sm:p-8">
    <Swords aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 size-72 rotate-12 text-primary-foreground/5" strokeWidth={1} />
    <div className="relative flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3"><span className="inline-flex rounded-full bg-card"><StatusPill status={match.status} /></span><span className="text-xs font-semibold tracking-widest">GIAO LƯU · {match.matchType === 'GROUP' ? 'NHÓM CHƠI' : match.matchType === 'SINGLES' ? 'ĐẤU ĐƠN' : 'ĐẤU ĐÔI'}</span></div>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start"><div className="max-w-2xl"><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Chi tiết trận {match.matchType === 'GROUP' ? 'giao lưu' : match.matchType === 'SINGLES' ? 'đấu đơn' : 'đấu đôi'}</h1><p className="mt-3 text-sm leading-6 text-primary-foreground/85">{matchStatusDescriptions[match.status]}</p></div>
        <div className="flex shrink-0 flex-col gap-2 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-4 lg:max-w-60"><span className="text-xs font-semibold tracking-widest">MÃ TRẬN ĐẤU</span><div className="flex flex-wrap items-center gap-4"><strong className="select-all text-2xl">#{match.id}</strong><Button type="button" variant="outline" className="h-11 bg-card text-foreground" onClick={() => void copy()}><Copy aria-hidden="true" />Sao chép</Button></div>{copied && <small role="status" className="text-xs leading-5">{copied}</small>}</div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-primary-foreground/20 pt-5 text-sm font-medium"><span className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-4 shrink-0" />{matchDate(match.scheduledAt)}</span><span className="flex items-center gap-2"><Clock3 aria-hidden="true" className="size-4 shrink-0" />{matchTimeRange(match)}</span><span className="flex items-center gap-2"><Users aria-hidden="true" className="size-4 shrink-0" />{match.currentPlayers}/{match.requiredPlayers} người</span></div>
    </div>
  </header>;
}

export function MatchSchedule({ match }: { match: MatchDetail }) {
  const address = match.facility ? [match.facility.address, match.facility.ward, match.facility.district, match.facility.city].filter(Boolean).join(', ') : null;
  return <ContentPanel title="Sân thi đấu & lịch trình" icon={MapPin}>
    <Badge variant={match.court ? 'success' : 'neutral'} className="w-fit">{match.court ? 'Đã có sân' : 'Chưa có sân'}</Badge>
    <div className="grid gap-3 sm:grid-cols-2"><div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-4"><span className="text-xs font-semibold text-muted-foreground">NGÀY CHƠI</span><strong className="text-sm">{matchDate(match.scheduledAt)}</strong></div><div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-4"><span className="text-xs font-semibold text-muted-foreground">KHUNG GIỜ</span><strong className="text-sm">{matchTimeRange(match)}</strong></div></div>
    {match.facility ? <div className="flex items-start gap-3 border-t border-border pt-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-success-bg text-primary"><MapPin aria-hidden="true" className="size-5" /></span><div className="min-w-0"><h3 className="text-base font-bold">{match.court?.name ?? 'Sân chưa xác định'}</h3><Link className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/facilities/${match.facility.id}`}>{match.facility.name}</Link><p className="text-sm leading-6 text-muted-foreground">{address}</p></div></div>
      : <p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Lịch hiện tại là dự kiến. Thông tin sân và khung giờ chính thức sẽ hiển thị sau khi booking được liên kết.</p>}
  </ContentPanel>;
}

function Players({ players, viewerId }: { players: MatchDetail['players']; viewerId?: number }) {
  return <ul className="flex flex-col gap-3">{players.map(player => <li key={player.playerId} className={cn('flex items-start gap-3 rounded-lg border border-border bg-card p-3', player.status === 'LEFT' && 'bg-muted/60')}>
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-bg text-base font-bold text-primary" aria-hidden="true">{(player.displayName?.trim() || '?').slice(0, 1).toUpperCase()}</span>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2"><PlayerProfileButton playerId={player.playerId} displayName={player.displayName} />{player.playerId === viewerId && <Badge variant="success">Bạn</Badge>}</div><p className="text-xs leading-5 text-muted-foreground">{player.skill?.name ?? 'Chưa xác định trình độ'}</p>{player.status === 'LEFT' && <Badge className="mt-1">Đã rời</Badge>}</div>
  </li>)}</ul>;
}

export function MatchTeams({ match }: { match: MatchDetail }) {
  const { user } = useAuth();
  return <ContentPanel title={match.matchType === 'GROUP' ? 'Người chơi trong nhóm' : 'Đội hình thi đấu'} icon={Users}>
    <span className="text-sm text-muted-foreground">{match.currentPlayers}/{match.requiredPlayers} người</span>
    {match.matchType === 'GROUP' ? <><Players players={match.players} viewerId={user?.id} />{match.players.length === 0 && <p className="text-sm text-muted-foreground">Chưa có thông tin người chơi.</p>}</> : <div className="grid gap-4 sm:grid-cols-2">{[1, 2].map(team => <div className="flex min-w-0 flex-col gap-4 rounded-2xl bg-muted/50 p-4" key={team}>
      <h3 className="flex items-center gap-2 text-base font-bold"><span className={cn('size-2 rounded-full', team === 1 ? 'bg-primary' : 'bg-info')} />Đội {team === 1 ? 'A' : 'B'}</h3>
      <Players players={match.players.filter(player => player.teamNo === team)} viewerId={user?.id} />
      {!match.players.some(player => player.teamNo === team) && <p className="text-sm text-muted-foreground">Chưa có thông tin người chơi.</p>}
    </div>)}</div>}
  </ContentPanel>;
}

export function MatchCost({ match }: { match: MatchDetail }) {
  const payer = match.players.find(player => player.playerId === match.payer?.playerId);
  const sharing = match.costSharing;
  return <ContentPanel title="Chi phí & booking" icon={Receipt}>
    <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-4"><span className="text-sm text-muted-foreground">Tổng tiền sân</span><strong className="text-2xl font-extrabold tracking-tight">{match.price === null ? 'Chưa có thông tin' : `${match.price.toLocaleString('vi-VN')} ₫`}</strong></div>
    <p className="text-sm text-muted-foreground">Người thanh toán: {match.payer ? payer?.displayName ?? 'Chưa có tên người thanh toán' : 'Chưa có thông tin'}</p>
    {sharing
      ? <>
        <p className="text-sm text-muted-foreground">Chia đều cho {sharing.memberCount} người{sharing.shareAmount !== null ? ` · khoảng ${sharing.shareAmount.toLocaleString('vi-VN')} ₫/người` : ''}</p>
        <ul className="flex flex-col gap-2">
          {sharing.members.map(member => <li key={member.playerId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-border pt-2 text-sm first:border-t-0 first:pt-0">
            <span>{member.displayName ?? `Người chơi #${member.playerId}`}{member.isHost ? ' (chủ kèo)' : ''}</span>
            <strong>{member.amount.toLocaleString('vi-VN')} ₫</strong>
            <span className={member.status === 'PAID' ? 'text-xs font-bold text-primary' : 'text-xs font-bold text-muted-foreground'}>{member.status === 'PAID' ? 'Đã trả' : 'Đã hoàn'}</span>
          </li>)}
        </ul>
      </>
      : <p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Chủ kèo thanh toán toàn bộ booking sân. Hệ thống không chia tiền theo từng người chơi.</p>}
    {match.isOwner && match.booking && <Button asChild variant="outline" className="h-11"><Link to={`/bookings/${match.booking.id}`}>Xem booking sân</Link></Button>}
    {match.status === 'CANCELLED' && match.isOwner && match.booking && <p className="text-xs leading-5 text-muted-foreground">Theo dõi việc hủy booking và hoàn tiền tại chi tiết booking. Hủy trận không đồng nghĩa tiền đã được hoàn.</p>}
  </ContentPanel>;
}
