import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ellipsis, Flag, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';
import { ReportDialog } from '../../../components/common/ReportDialog';
import { AuthorizedImage } from '../../../components/common/AuthorizedImage';
import { ReactionPicker } from '../../../components/common/ReactionPicker';
import { REACTIONS, type ReactionType } from '../../../components/common/reactions';
import type { PostCard } from '../types';
import type { SkillLevel } from '../../matchmaking/types/matchmaking';
import { socialApi } from '../api';
import { dateTime, socialError } from '../utils';
import { AuthorRow, Notice } from './SocialUi';
import { backgroundClass } from './post-backgrounds';
import { PostComposer } from './PostComposer';
import { Textarea } from '@/components/ui/textarea';
import { ResultPostCard } from '../../tournaments/components/ResultPostCard';

export function SocialPostCard({ post, skills, detail = false, onChanged, onDeleted }: { post: PostCard; skills: SkillLevel[]; detail?: boolean; onChanged: (post: PostCard) => void; onDeleted: (id: number) => void }) {
  const [editing, setEditing] = useState(false); const [deleting, setDeleting] = useState(false); const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const pending = useRef(false);
  const [showReactions, setShowReactions] = useState(detail);
  const [disabled, setDisabled] = useState(false);
  const nextAction = useRef<'edit' | 'delete' | 'report' | null>(null); const menuTrigger = useRef<HTMLButtonElement>(null);
  const act = async (command: () => Promise<unknown>, remove = false) => {
    if (pending.current) return; pending.current = true; setBusy(true); setError('');
    try { await command(); if (remove) onDeleted(post.id); else onChanged(await socialApi.post(post.id)); }
    catch (reason) { setError(socialError(reason)); if (reason instanceof Error && 'code' in reason && reason.code === 'SOCIAL_DISABLED') setDisabled(true); }
    finally { pending.current = false; setBusy(false); }
  };
  const react = (type: ReactionType | null) => { void act(() => socialApi.reaction(post.id, type)); };
  const current = REACTIONS.find(item => item.type === post.reactions.viewerReaction);
  const images = [...post.images].sort((a, b) => a.position - b.position);
  return <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm wrap-anywhere sm:p-6" aria-label={`Bài viết của ${post.author.displayName ?? 'người chơi'}`}>
    <AuthorRow person={post.author} subtitle={`${post.author.skillLevel?.name ?? 'Người chơi'} · ${dateTime(post.createdAt)}`}>
      {/* Edit/delete/report open after the menu has returned focus to its trigger; the composer restores focus to it. */}
      <DropdownMenu>
        <DropdownMenuTrigger ref={menuTrigger} asChild><Button type="button" variant="ghost" size="icon" className="rounded-full" aria-label="Thao tác bài viết"><Ellipsis aria-hidden="true" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-58" onCloseAutoFocus={() => {
          const action = nextAction.current; nextAction.current = null;
          if (action === 'edit') setEditing(true); else if (action === 'delete') setDeleting(true); else if (action === 'report') setReporting(true);
        }}>
          {post.isAuthor ? <>
            <DropdownMenuItem disabled={disabled || busy} onSelect={() => { nextAction.current = 'edit'; }}><Pencil aria-hidden="true" />Chỉnh sửa bài viết</DropdownMenuItem>
            <DropdownMenuItem disabled={busy} className="text-danger focus:bg-danger-bg focus:text-danger" onSelect={() => { nextAction.current = 'delete'; }}><Trash2 aria-hidden="true" />Xóa bài viết</DropdownMenuItem>
          </> : <DropdownMenuItem disabled={disabled || busy} onSelect={() => { nextAction.current = 'report'; }}><Flag aria-hidden="true" />Báo cáo bài viết</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    </AuthorRow>
    {post.type === 'TOURNAMENT_RESULT' && post.tournamentResult && <ResultPostCard data={post.tournamentResult} />}
    {post.body && <div className={cn(backgroundClass(post.background) && !images.length && 'flex min-h-72 items-center justify-center rounded-2xl px-6 py-12 sm:min-h-80', !images.length && backgroundClass(post.background))}><p className={cn('whitespace-pre-wrap break-words text-base leading-7 [overflow-wrap:anywhere]', backgroundClass(post.background) && !images.length && 'text-center text-2xl font-bold leading-relaxed sm:text-3xl')}>{post.body}</p></div>}
    {!!images.length && <div className={cn('grid gap-2', images.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>{images.map((image, i) => <div key={`${image.id}-${image.url}`}
      className={cn('min-w-0 overflow-hidden rounded-lg [&>button]:h-full', images.length === 1 ? '[&>button]:max-h-112.5 [&_img]:max-h-112.5 [&_img]:object-contain' : detail ? 'h-40 md:h-65' : 'h-40 md:h-45')}>
      <AuthorizedImage src={image.url} alt={`Ảnh bài viết ${i + 1}`} expandable />
    </div>)}</div>}
    {post.isEdited && <small className="text-xs text-muted-foreground">Đã chỉnh sửa</small>}
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
    {editing && post.type !== 'TOURNAMENT_RESULT' && <PostComposer post={post} type="FREE" skills={skills} onClose={() => setEditing(false)} onSaved={saved => { onChanged(saved); setEditing(false); }} />}
    {editing && post.type === 'TOURNAMENT_RESULT' && <ResultBodyEditor post={post} onClose={() => setEditing(false)} onSaved={saved => { onChanged(saved); setEditing(false); }} />}
    <Dialog open={deleting} onOpenChange={open => { if (!open && !busy) setDeleting(false); }}>
      <DialogContent onCloseAutoFocus={event => { event.preventDefault(); menuTrigger.current?.focus(); }}>
        <DialogTitle>Xóa bài chia sẻ?</DialogTitle>
        <DialogDescription className="mt-3 leading-6">Bài viết sẽ không còn hiển thị trong cộng đồng.</DialogDescription>
        {error && <div className="mt-4"><Notice error>{error}</Notice></div>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => setDeleting(false)}>Giữ bài viết</Button>
          <Button type="button" className="h-11 bg-danger text-primary-foreground hover:bg-danger-hover" disabled={busy} onClick={() => void act(() => socialApi.delete(post.id), true)}>{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</Button>
        </div>
      </DialogContent>
    </Dialog>
    {reporting && <ReportDialog targetType="POST" targetId={post.id} onClose={() => setReporting(false)} />}
  </article>;
}

/** A tournament result post edits only its text; the card comes from the tournament (Tech Design §4.3b). */
function ResultBodyEditor({ post, onClose, onSaved }: { post: PostCard; onClose: () => void; onSaved: (post: PostCard) => void }) {
  const [body, setBody] = useState(post.body ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try { onSaved(await socialApi.edit(post.id, { body: body.trim(), keepImageIds: [] }, [])); }
    catch (reason) { setError(socialError(reason)); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent closeDisabled={busy}>
      <DialogTitle>Sửa lời chia sẻ</DialogTitle>
      <DialogDescription className="mt-2">Thẻ kết quả giải được lấy từ giải đấu và không chỉnh sửa được.</DialogDescription>
      <Textarea aria-label="Lời chia sẻ" className="mt-4 min-h-32" maxLength={2000} value={body} onChange={e => setBody(e.target.value)} />
      {error && <div className="mt-3"><Notice error>{error}</Notice></div>}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={onClose}>Huỷ</Button>
        <Button type="button" variant="brand" className="h-11" disabled={busy} onClick={() => void save()}>{busy ? 'Đang lưu…' : 'Lưu'}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
