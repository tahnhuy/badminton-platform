import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Ellipsis, Flag, Gauge, MapPin, MessageCircle, Pencil, Trash2, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';
import { AuthorizedImage } from '../../../components/common/AuthorizedImage';
import { ReactionPicker } from '../../../components/common/ReactionPicker';
import { REACTIONS, type ReactionType } from '../../../components/common/reactions';
import { PlayerProfileButton } from '../../player/profile/PlayerProfileButton';
import type { PostCard } from '../types';
import type { SkillLevel } from '../../matchmaking/types/matchmaking';
import { socialApi } from '../api';
import { dateTime, matchTypeLabels, playTime, recruitmentStatusLabels, socialError } from '../utils';
import { AuthorRow, Notice } from './SocialUi';
import { PostComposer } from './PostComposer';
import { useBeforeInstant } from '../../../shared/hooks/useBeforeInstant';

function Fact({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <li className="flex min-w-0 items-start gap-2.5"><Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><div className="flex min-w-0 flex-col gap-0.5">{children}</div></li>;
}

export function SocialPostCard({ post, skills, detail = false, onChanged, onDeleted }: { post: PostCard; skills: SkillLevel[]; detail?: boolean; onChanged: (post: PostCard) => void; onDeleted: (id: number) => void }) {
  const [editing, setEditing] = useState(false); const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const pending = useRef(false);
  const [showReactions, setShowReactions] = useState(detail);
  const [disabled, setDisabled] = useState(false);
  const nextAction = useRef<'edit' | 'delete' | null>(null); const menuTrigger = useRef<HTMLButtonElement>(null);
  const recruitment = post.recruitment;
  const beforeStart = useBeforeInstant(recruitment?.startAt);
  const act = async (command: () => Promise<unknown>, remove = false) => {
    if (pending.current) return; pending.current = true; setBusy(true); setError('');
    try { await command(); if (remove) onDeleted(post.id); else onChanged(await socialApi.post(post.id)); }
    catch (reason) { setError(socialError(reason)); if (reason instanceof Error && 'code' in reason && reason.code === 'SOCIAL_DISABLED') setDisabled(true); }
    finally { pending.current = false; setBusy(false); }
  };
  const react = (type: ReactionType | null) => { void act(() => socialApi.reaction(post.id, type)); };
  const current = REACTIONS.find(item => item.type === post.reactions.viewerReaction);
  const startedActive = recruitment && !['CANCELLED', 'EXPIRED'].includes(recruitment.status) && !beforeStart;
  const images = [...post.images].sort((a, b) => a.position - b.position);
  return <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm wrap-anywhere sm:p-6" aria-label={`Bài viết của ${post.author.displayName ?? 'người chơi'}`}>
    <AuthorRow person={post.author} subtitle={`${post.author.skillLevel?.name ?? 'Người chơi'} · ${dateTime(post.createdAt)}`}>
      {/* Edit/delete open after the menu has returned focus to its trigger; the composer restores focus to it. */}
      <DropdownMenu>
        <DropdownMenuTrigger ref={menuTrigger} asChild><Button type="button" variant="ghost" size="icon" className="rounded-full" aria-label="Thao tác bài viết"><Ellipsis aria-hidden="true" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-58" onCloseAutoFocus={() => {
          const action = nextAction.current; nextAction.current = null;
          if (action === 'edit') setEditing(true); else if (action === 'delete') setDeleting(true);
        }}>
          {post.isAuthor ? <>
            <DropdownMenuItem disabled={disabled || busy} onSelect={() => { nextAction.current = 'edit'; }}><Pencil aria-hidden="true" />Chỉnh sửa bài viết</DropdownMenuItem>
            <DropdownMenuItem disabled={busy} className="text-danger focus:bg-danger-bg focus:text-danger" onSelect={() => { nextAction.current = 'delete'; }}><Trash2 aria-hidden="true" />Xóa bài viết</DropdownMenuItem>
          </> : <>
            <DropdownMenuItem disabled><Flag aria-hidden="true" />Báo cáo bài viết</DropdownMenuItem>
            <DropdownMenuLabel className="pt-0 text-xs text-muted-foreground">Báo cáo đang được hoàn thiện.</DropdownMenuLabel>
          </>}
        </DropdownMenuContent>
      </DropdownMenu>
    </AuthorRow>
    {recruitment && <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success">{matchTypeLabels[recruitment.matchType]}</Badge>
        <Badge>{recruitment.ended ? (recruitment.status === 'OPEN' ? 'Đã ngừng tuyển' : recruitmentStatusLabels[recruitment.status] ?? 'Đã ngừng tuyển') : recruitmentStatusLabels[recruitment.status] ?? recruitment.status}</Badge>
        {!post.publishedAt && <Badge className="bg-caution-bg text-caution">Chưa công khai</Badge>}
      </div>
      <h2 className="text-xl font-bold tracking-tight"><Link className="rounded-md hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/posts/${post.id}`}>{post.title || `${matchTypeLabels[recruitment.matchType]} · ${dateTime(recruitment.startAt)}`}</Link></h2>
      <ul className="grid gap-3 rounded-lg bg-muted/60 p-4 text-sm sm:grid-cols-2">
        <Fact icon={CalendarClock}><span className="font-semibold">{playTime(recruitment.startAt, recruitment.durationMinutes)}</span></Fact>
        {recruitment.access !== 'INVITEE' && <Fact icon={MapPin}>{recruitment.externalCourt ? <>
          <span className="font-semibold">{recruitment.externalCourt.name} · {recruitment.externalCourt.district}, {recruitment.externalCourt.city}</span>
          <small className="text-xs text-muted-foreground">{recruitment.externalCourt.address}</small>
          <small className="text-xs text-muted-foreground">Thông tin sân do chủ kèo cung cấp</small>
        </> : <span>Chưa có sân</span>}</Fact>}
        <Fact icon={Gauge}><span>{recruitment.skillRange.min.name ?? 'Chưa rõ trình độ'} – {recruitment.skillRange.max.name ?? 'Chưa rõ trình độ'}</span></Fact>
        {recruitment.costNote && <Fact icon={Wallet}><span>{recruitment.costNote}</span></Fact>}
      </ul>
      <Notice><span className="flex items-center gap-2"><Users aria-hidden="true" className="size-4 shrink-0 text-primary" /><strong>{recruitment.filledSlots}/{recruitment.capacity} chỗ · {recruitment.hasOpenSlots ? `Còn ${recruitment.capacity - recruitment.filledSlots} chỗ` : 'Đã ngừng nhận thêm'}</strong></span><small>{recruitment.matchType === 'GROUP' ? `Bao gồm chủ kèo và ${recruitment.companionCount} người đi cùng · Tối thiểu ${recruitment.minPlayers}` : 'Tổng số chỗ bao gồm chủ kèo.'}</small></Notice>
      {detail && !!recruitment.members?.length && <div className="flex flex-col gap-2"><h3 className="text-sm font-bold">Người chơi đã xác nhận</h3><div className="flex flex-wrap items-center gap-x-4">{recruitment.members.map(member => <PlayerProfileButton key={member.playerId} playerId={member.playerId} displayName={member.displayName} showAvatar />)}</div></div>}
    </section>}
    {post.body && <p className="whitespace-pre-wrap text-base leading-7">{post.body}</p>}
    {!!images.length && <div className={cn('grid gap-2', images.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>{images.map((image, i) => <div key={`${image.id}-${image.url}`}
      className={cn('min-w-0 overflow-hidden rounded-lg [&>button]:h-full', images.length === 1 ? '[&>button]:max-h-112.5 [&_img]:max-h-112.5 [&_img]:object-contain' : detail ? 'h-40 md:h-65' : 'h-40 md:h-45')}>
      <AuthorizedImage src={image.url} alt={`Ảnh bài viết ${i + 1}`} expandable />
    </div>)}</div>}
    {post.isEdited && <small className="text-xs text-muted-foreground">Đã chỉnh sửa</small>}
    {recruitment && <div className="flex flex-wrap gap-2">
      {!detail && <Button asChild variant="outline" className="h-11"><Link to={`/posts/${post.id}`}>Xem chi tiết</Link></Button>}
      {recruitment.viewerRelation === 'HOST' && <Button asChild className="h-11"><Link to={`/matchmaking/requests/${recruitment.requestId}`}>Quản lý kèo</Link></Button>}
    </div>}
    <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
      <span>{REACTIONS.filter(r => post.reactions.counts[r.type] > 0).map(r => r.emoji).join(' ')} {post.reactions.total} cảm xúc</span>
      <Link className="rounded-md hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/posts/${post.id}#comments`}>{post.commentCount} bình luận</Link>
    </div>
    {showReactions && <ReactionPicker value={post.reactions.viewerReaction} onChange={react} disabled={busy || disabled} />}
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant="ghost" className={cn('h-11', current && 'bg-success-bg text-success hover:bg-success-bg-hover hover:text-success')} aria-expanded={showReactions} aria-pressed={!!current} disabled={disabled} onClick={() => setShowReactions(value => !value)}>
        {current ? `${current.emoji} ${current.label}` : '👍 Thích'}
      </Button>
      <Button asChild variant="ghost" className="h-11"><Link to={`/posts/${post.id}#comments`}><MessageCircle aria-hidden="true" />Bình luận</Link></Button>
    </div>
    {error && <Notice error>{error}</Notice>}
    {editing && <PostComposer post={post} type={post.type} skills={skills} onClose={() => setEditing(false)} onSaved={saved => { onChanged(saved); setEditing(false); }} />}
    <Dialog open={deleting} onOpenChange={open => { if (!open && !busy) setDeleting(false); }}>
      <DialogContent onCloseAutoFocus={event => { event.preventDefault(); menuTrigger.current?.focus(); }}>
        <DialogTitle>{post.type === 'MATCH_FINDING' ? 'Xóa bài tìm kèo?' : 'Xóa bài chia sẻ?'}</DialogTitle>
        <DialogDescription className="mt-3 leading-6">{post.type === 'MATCH_FINDING' ? startedActive ? 'Chỉ xóa được khi kèo đã kết thúc. Kèo đang diễn ra không thể xóa. Booking được giữ nguyên.' : 'Xóa bài đang hoạt động sẽ hủy kèo và đóng các lời mời đang chờ. Thành viên bị ảnh hưởng sẽ được thông báo. Booking được giữ nguyên; bạn tự quản lý booking riêng.' : 'Bài viết sẽ không còn hiển thị trong cộng đồng.'}</DialogDescription>
        {error && <div className="mt-4"><Notice error>{error}</Notice></div>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => setDeleting(false)}>Giữ bài viết</Button>
          <Button type="button" className="h-11 bg-danger text-primary-foreground hover:bg-danger-hover" disabled={busy} onClick={() => void act(() => socialApi.delete(post.id), true)}>{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </article>;
}
