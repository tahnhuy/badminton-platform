import { Link } from 'react-router-dom';
import { CalendarClock, Gauge, MapPin, Users, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AuthorRow } from '../../social/components/SocialUi';
import { dateTime, matchTypeLabels, playTime, recruitmentStatusLabels } from '../../social/utils';
import type { PostCard } from '../../social/types';
import type { SkillLevel } from '../types/matchmaking';
import { MatchPostMenu } from './MatchPostMenu';

/** Compact public recruitment card used by discovery; no reactions or comment counts. */
export function MatchDiscoveryCard({ post, skills, onChanged, onDeleted }: { post: PostCard; skills: SkillLevel[]; onChanged: (post: PostCard) => void; onDeleted: (id: number) => void }) {
  const recruitment = post.recruitment;
  if (!recruitment) return null;
  const title = post.title || `${matchTypeLabels[recruitment.matchType]} · ${dateTime(recruitment.startAt)}`;
  return <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm wrap-anywhere sm:p-6" aria-label={`Kèo ${title}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success">{matchTypeLabels[recruitment.matchType]}</Badge>
        <Badge>{recruitment.ended ? (recruitment.status === 'OPEN' ? 'Đã ngừng tuyển' : recruitmentStatusLabels[recruitment.status] ?? 'Đã ngừng tuyển') : recruitmentStatusLabels[recruitment.status] ?? recruitment.status}</Badge>
        {recruitment.hasOpenSlots && <Badge className="bg-success-bg text-success">Còn {recruitment.capacity - recruitment.filledSlots} chỗ</Badge>}
      </div>
      <AuthorRow person={post.author} subtitle={post.author.skillLevel?.name ?? 'Người chơi'}><MatchPostMenu post={post} skills={skills} onChanged={onChanged} onDeleted={onDeleted} /></AuthorRow>
    </div>
    <h2 className="text-lg font-bold tracking-tight"><Link className="rounded-md hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/posts/${post.id}`}>{title}</Link></h2>
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
      <li className="flex items-center gap-1.5"><CalendarClock aria-hidden="true" className="size-4 text-primary" />{playTime(recruitment.startAt, recruitment.durationMinutes)}</li>
      <li className="flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-4 text-primary" />{recruitment.externalCourt ? `${recruitment.externalCourt.name} · ${recruitment.externalCourt.district}, ${recruitment.externalCourt.city}` : 'Chưa có sân'}</li>
      <li className="flex items-center gap-1.5"><Gauge aria-hidden="true" className="size-4 text-primary" />{recruitment.skillRange.min.name ?? 'Chưa rõ'} – {recruitment.skillRange.max.name ?? 'Chưa rõ'}</li>
      <li className="flex items-center gap-1.5"><Users aria-hidden="true" className="size-4 text-primary" />{recruitment.filledSlots}/{recruitment.capacity} chỗ</li>
      {recruitment.costNote && <li className="flex items-center gap-1.5"><Wallet aria-hidden="true" className="size-4 text-primary" />{recruitment.costNote}</li>}
    </ul>
    {post.body && <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{post.body}</p>}
    <div className="flex flex-wrap gap-2">
      <Button asChild className="h-11"><Link to={`/posts/${post.id}`}>Xem kèo</Link></Button>
      {recruitment.viewerRelation === 'HOST' && <Button asChild variant="outline" className="h-11"><Link to={`/matchmaking/requests/${recruitment.requestId}`}>Quản lý kèo</Link></Button>}
    </div>
  </article>;
}
