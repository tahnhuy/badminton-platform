import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../../components/common/Dialog';
import { ReportDialog } from '../../../components/common/ReportDialog';
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
  const [deleting, setDeleting] = useState<PostComment | null>(null); const [reporting, setReporting] = useState<PostComment | null>(null); const pending = useRef(false); const loadingMore = useRef(false); const generation = useRef(0);
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
  return <section className="social-card" id="comments" aria-label="Bình luận"><h2>Bình luận{meta ? ` · ${meta.total}` : ''}</h2>
    {comments.map(comment => <div className="social-comment" key={comment.id}><AuthorRow person={comment.author} subtitle={dateTime(comment.createdAt)} /><p className="social-body">{comment.body}</p><div className="social-actions">{comment.canDelete && <button className="social-text-button social-text-danger" disabled={busy} onClick={() => { setError(''); setDeleting(comment); }}>Xóa bình luận</button>}{comment.author.id !== viewerId && <button className="social-text-button" disabled={busy || disabled} onClick={() => setReporting(comment)}>Báo cáo</button>}</div></div>)}
    {loading && <p role="status">Đang tải bình luận…</p>}{!loading && !comments.length && !loadError && <p>Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.</p>}
    {loadError && <Notice error>{loadError}<button className="social-button" onClick={() => meta ? void more() : reload()}>Thử tải lại bình luận</button></Notice>}
    {meta && meta.page < meta.totalPages && <button className="social-button" disabled={loading} onClick={() => void more()}>Xem thêm bình luận</button>}
    <form className="social-stack" onSubmit={e => { e.preventDefault(); const text = body.trim(); if (!text) return; if (request.current?.body !== text) request.current = { body: text, key: crypto.randomUUID() }; void act(() => socialApi.comment(postId, text, request.current!.key), true); }}>
      <label>Viết bình luận<textarea maxLength={500} rows={3} value={body} disabled={busy || disabled} onChange={e => setBody(e.target.value)} placeholder="Chia sẻ ý kiến của bạn…" required /></label><small>{[...body].length}/500 ký tự · Bình luận không giữ chỗ tham gia kèo.</small>
      <button className="social-button social-primary" disabled={busy || disabled || !body.trim()} type="submit">{busy ? 'Đang xử lý…' : 'Gửi bình luận'}</button>
    </form>{error && !deleting && <Notice error>{error}</Notice>}
    {deleting && <Dialog title="Xóa bình luận?" busy={busy} onClose={() => setDeleting(null)}><div className="social-stack"><p>Bình luận sẽ không còn hiển thị dưới bài viết.</p>{error && <Notice error>{error}</Notice>}<div className="social-actions"><button className="social-button" disabled={busy} onClick={() => setDeleting(null)}>Giữ bình luận</button><button className="social-button social-danger-solid" disabled={busy} onClick={() => void act(() => socialApi.deleteComment(deleting.id))}>Xác nhận xóa bình luận</button></div></div></Dialog>}
    {reporting && <ReportDialog targetType="COMMENT" targetId={reporting.id} onClose={() => setReporting(null)} />}
  </section>;
}
