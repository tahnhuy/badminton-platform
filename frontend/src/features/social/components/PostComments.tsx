import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { socialApi } from '../api';
import type { PageMeta, PostComment } from '../types';
import { dateTime, socialError } from '../utils';
import { AuthorRow, Notice } from './SocialUi';
import { useVisibilityRefresh } from '../../../shared/hooks/useVisibilityRefresh';
import { ApiError } from '../../../shared/api/http-client';

export function PostComments({ postId, viewerId, onCountChanged }: { postId: number; viewerId: number; onCountChanged: () => void }) {
  const [comments, setComments] = useState<PostComment[]>([]); const [meta, setMeta] = useState<PageMeta | null>(null);
  const [revision, setRevision] = useState(0); const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState('');
  const [body, setBody] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [disabled, setDisabled] = useState(false);
  const [deleting, setDeleting] = useState<PostComment | null>(null); const pending = useRef(false); const loadingMore = useRef(false); const generation = useRef(0);
  const request = useRef<{ body: string; key: string } | null>(null);
  const reload = () => setRevision(value => value + 1);
  useVisibilityRefresh(reload);
  useEffect(() => {
    const current = ++generation.current; const controller = new AbortController(); setLoading(true); setLoadError(''); loadingMore.current = true;
    void socialApi.comments(postId, 1, controller.signal).then(result => { if (current === generation.current) { setComments(result.data); setMeta(result.meta); } })
      .catch(reason => { if (!controller.signal.aborted && current === generation.current) setLoadError(socialError(reason)); })
      .finally(() => { if (current === generation.current) { setLoading(false); loadingMore.current = false; } });
    return () => { generation.current = current + 1; controller.abort(); };
  }, [postId, revision]);
  const more = async () => {
    if (!meta || loadingMore.current || meta.page >= meta.totalPages) return;
    const current = generation.current; loadingMore.current = true; setLoading(true); setLoadError('');
    try { const result = await socialApi.comments(postId, meta.page + 1); if (current === generation.current) { setComments(rows => [...new Map([...rows, ...result.data].map(row => [row.id, row])).values()]); setMeta(result.meta); } }
    catch (reason) { if (current === generation.current) setLoadError(socialError(reason)); }
    finally { if (current === generation.current) { loadingMore.current = false; setLoading(false); } }
  };
  const act = async (command: () => Promise<unknown>, sending = false) => {
    if (pending.current) return; pending.current = true; setBusy(true); setError('');
    try { await command(); if (sending) { setBody(''); request.current = null; } setDeleting(null); reload(); onCountChanged(); }
    catch (reason) { setError(socialError(reason)); if (reason instanceof ApiError && reason.code === 'SOCIAL_DISABLED') setDisabled(true); }
    finally { pending.current = false; setBusy(false); }
  };
  return <section id="comments" aria-label="Bình luận" className="flex min-w-0 scroll-mt-24 flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
    <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight"><MessageCircle aria-hidden="true" className="size-5 text-primary" />Bình luận{meta ? ` · ${meta.total}` : ''}</h2>
    {!!comments.length && <ul className="flex flex-col">{comments.map(comment => <li key={comment.id} className="flex flex-col gap-2 border-b border-border py-4 first:pt-0 last:border-b-0">
      <AuthorRow person={comment.author} subtitle={dateTime(comment.createdAt)} />
      <p className="whitespace-pre-wrap pl-13 text-sm leading-6 wrap-anywhere">{comment.body}</p>
      <div className="flex flex-wrap items-center gap-1 pl-11">
        {comment.canDelete && <Button type="button" variant="ghost" className="h-9 px-2 text-danger hover:bg-danger-bg hover:text-danger" disabled={busy} onClick={() => { setError(''); setDeleting(comment); }}><Trash2 aria-hidden="true" />Xóa bình luận</Button>}
        {comment.author.id !== viewerId && <Button type="button" variant="ghost" className="h-9 px-2" disabled title="Báo cáo đang được hoàn thiện">Báo cáo</Button>}
      </div>
    </li>)}</ul>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Đang tải bình luận…</p>}
    {!loading && !comments.length && !loadError && <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.</p>}
    {loadError && <Notice error>{loadError}<Button type="button" variant="outline" className="h-11" onClick={() => meta ? void more() : reload()}>Thử tải lại bình luận</Button></Notice>}
    {meta && meta.page < meta.totalPages && <Button type="button" variant="outline" className="h-11 self-start" disabled={loading} onClick={() => void more()}>Xem thêm bình luận</Button>}
    <form className="flex flex-col gap-2 border-t border-border pt-4" onSubmit={e => { e.preventDefault(); const text = body.trim(); if (!text) return; if (request.current?.body !== text) request.current = { body: text, key: crypto.randomUUID() }; void act(() => socialApi.comment(postId, text, request.current!.key), true); }}>
      <Label htmlFor={`comment-${postId}`} className="text-xs font-semibold text-muted-foreground">Viết bình luận</Label>
      <Textarea id={`comment-${postId}`} maxLength={500} rows={3} value={body} disabled={busy || disabled} onChange={e => setBody(e.target.value)} placeholder="Chia sẻ ý kiến của bạn…" required />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <small className="text-xs leading-5 text-muted-foreground">{[...body].length}/500 ký tự · Bình luận không giữ chỗ tham gia kèo.</small>
        <Button className="h-11" disabled={busy || disabled || !body.trim()} type="submit"><Send aria-hidden="true" />{busy ? 'Đang xử lý…' : 'Gửi bình luận'}</Button>
      </div>
    </form>{error && !deleting && <Notice error>{error}</Notice>}
    {deleting && <ConfirmDialog title="Xóa bình luận?" description="Bình luận sẽ không còn hiển thị dưới bài viết." error={error} busy={busy} tone="danger" cancelLabel="Giữ bình luận" confirmLabel="Xác nhận xóa bình luận" onCancel={() => setDeleting(null)} onConfirm={() => void act(() => socialApi.deleteComment(deleting.id))} />}
  </section>;
}
