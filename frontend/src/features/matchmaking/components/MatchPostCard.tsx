import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Gauge, MapPin, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { AuthorizedImage } from '../../../components/common/AuthorizedImage';
import { AuthorRow, Notice } from '../../social/components/SocialUi';
import { dateTime, matchTypeLabels, playTime, recruitmentStatusLabels } from '../../social/utils';
import type { PostCard } from '../../social/types';
import type { SkillLevel } from '../types/matchmaking';
import { MatchPostMenu } from './MatchPostMenu';

function Fact({ icon: Icon, children, label }: { icon: LucideIcon; children: ReactNode; label?: string }) {
  return <li className="flex min-w-0 items-start gap-2.5"><Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><div className="flex min-w-0 flex-col gap-0.5">{label && <span className="text-xs text-muted-foreground">{label}</span>}{children}</div></li>;
}

/** Presentation for a match-finding post: recruitment facts and business actions only. */
export function MatchPostCard({ post, skills, detail = false, onChanged, onDeleted }: { post: PostCard; skills: SkillLevel[]; detail?: boolean; onChanged: (post: PostCard) => void; onDeleted: (id: number) => void }) {
  const recruitment = post.recruitment;
  const images = [...post.images].sort((a, b) => a.position - b.position);
  return <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm wrap-anywhere sm:p-6" aria-label={`Bài tìm kèo của ${post.author.displayName ?? 'người chơi'}`}>
    <AuthorRow person={post.author} subtitle={`${post.author.skillLevel?.name ?? 'Người chơi'} · ${dateTime(post.createdAt)}`}>
      <MatchPostMenu post={post} skills={skills} onChanged={onChanged} onDeleted={onDeleted} />
    </AuthorRow>
    {recruitment && <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success">{matchTypeLabels[recruitment.matchType]}</Badge>
        <Badge>{recruitment.ended ? (recruitment.status === 'OPEN' ? 'Đã ngừng tuyển' : recruitmentStatusLabels[recruitment.status] ?? 'Đã ngừng tuyển') : recruitmentStatusLabels[recruitment.status] ?? recruitment.status}</Badge>
        {!post.publishedAt && <Badge className="bg-caution-bg text-caution">Chưa công khai</Badge>}
      </div>
      {!detail && <h2 className="text-xl font-bold tracking-tight"><Link className="rounded-md hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/posts/${post.id}`}>{post.title || `${matchTypeLabels[recruitment.matchType]} · ${dateTime(recruitment.startAt)}`}</Link></h2>}
      <ul className={cn('grid rounded-lg text-sm sm:grid-cols-2', detail ? 'gap-5 border-b border-border pb-5 pt-2' : 'gap-3 bg-muted/60 p-4')}>
        <Fact icon={CalendarClock} label={detail ? 'Thời gian' : undefined}><span className="font-semibold">{playTime(recruitment.startAt, recruitment.durationMinutes)}</span></Fact>
        {recruitment.access !== 'INVITEE' && <Fact icon={MapPin} label={detail ? 'Địa điểm' : undefined}>{recruitment.externalCourt ? <>
          <span className="font-semibold">{recruitment.externalCourt.name} · {recruitment.externalCourt.district}, {recruitment.externalCourt.city}</span>
          <small className="text-xs text-muted-foreground">{recruitment.externalCourt.address}</small>
          <small className="text-xs text-muted-foreground">Thông tin sân do chủ kèo cung cấp</small>
        </> : <span>Chưa có sân</span>}</Fact>}
        <Fact icon={Gauge} label={detail ? 'Trình độ' : undefined}><span>{recruitment.skillRange.min.name ?? 'Chưa rõ trình độ'} – {recruitment.skillRange.max.name ?? 'Chưa rõ trình độ'}</span></Fact>
        {recruitment.costNote && <Fact icon={Wallet} label={detail ? 'Chi phí dự kiến' : undefined}><span>{recruitment.costNote}</span></Fact>}
      </ul>
      {!detail && <Notice><span className="flex items-center gap-2"><Users aria-hidden="true" className="size-4 shrink-0 text-primary" /><strong>{recruitment.filledSlots}/{recruitment.capacity} chỗ · {recruitment.hasOpenSlots ? `Còn ${recruitment.capacity - recruitment.filledSlots} chỗ` : 'Đã ngừng nhận thêm'}</strong></span><small>{recruitment.matchType === 'GROUP' ? `Bao gồm chủ kèo và ${recruitment.companionCount} người đi cùng · Tối thiểu ${recruitment.minPlayers}` : 'Tổng số chỗ bao gồm chủ kèo.'}</small></Notice>}
    </section>}
    {post.body && <div>{detail && <h3 className="mb-2 text-base font-bold">Về buổi chơi</h3>}<p className="whitespace-pre-wrap text-base leading-7">{post.body}</p></div>}
    {!!images.length && <div className={cn('grid gap-2', images.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>{images.map((image, i) => <div key={`${image.id}-${image.url}`}
      className={cn('min-w-0 overflow-hidden rounded-lg [&>button]:h-full', images.length === 1 ? '[&>button]:max-h-112.5 [&_img]:max-h-112.5 [&_img]:object-contain' : detail ? 'h-40 md:h-65' : 'h-40 md:h-45')}>
      <AuthorizedImage src={image.url} alt={`Ảnh bài kèo ${i + 1}`} expandable />
    </div>)}</div>}
    {post.isEdited && <small className="text-xs text-muted-foreground">Đã chỉnh sửa</small>}
    <div className="flex flex-wrap gap-2">
      {!detail && <Button asChild variant="outline" className="h-11"><Link to={`/posts/${post.id}`}>Xem kèo</Link></Button>}
      {!detail && recruitment?.viewerRelation === 'HOST' && <Button asChild className="h-11"><Link to={`/matchmaking/requests/${recruitment.requestId}`}>Quản lý kèo</Link></Button>}
    </div>
  </article>;
}
