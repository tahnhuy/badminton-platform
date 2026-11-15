import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog } from '../../../components/common/Dialog';
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
import ellipsis from '../assets/ellipsis.svg';
import { useBeforeInstant } from '../../../shared/hooks/useBeforeInstant';

export function SocialPostCard({ post, skills, detail = false, onChanged, onDeleted }: { post: PostCard; skills: SkillLevel[]; detail?: boolean; onChanged: (post: PostCard) => void; onDeleted: (id: number) => void }) {
  const [editing, setEditing] = useState(false); const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const pending = useRef(false);
  const [showReactions, setShowReactions] = useState(detail);
  const [disabled, setDisabled] = useState(false);
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
  return <article className="social-card social-post" aria-label={`Bài viết của ${post.author.displayName ?? 'người chơi'}`}>
    <AuthorRow person={post.author} subtitle={`${post.author.skillLevel?.name ?? 'Người chơi'} · ${dateTime(post.createdAt)}`}>
      <details className="social-post-menu"><summary aria-label="Thao tác bài viết"><img src={ellipsis} alt="" /></summary><div className="social-menu">
        {post.isAuthor ? <><button type="button" disabled={disabled || busy} onClick={() => setEditing(true)}>Chỉnh sửa bài viết</button><button className="social-menu-danger" type="button" disabled={busy} onClick={() => setDeleting(true)}>Xóa bài viết</button></> : <><button type="button" disabled>Báo cáo bài viết</button><small>Báo cáo đang được hoàn thiện.</small></>}
      </div></details>
    </AuthorRow>
    {recruitment && <section className="social-stack"><div className="social-actions"><span className="social-badge">{matchTypeLabels[recruitment.matchType]}</span><span className="social-badge social-badge-neutral">{recruitment.ended ? (recruitment.status === 'OPEN' ? 'Đã ngừng tuyển' : recruitmentStatusLabels[recruitment.status] ?? 'Đã ngừng tuyển') : recruitmentStatusLabels[recruitment.status] ?? recruitment.status}</span>{!post.publishedAt && <span className="social-badge social-badge-neutral">Chưa công khai</span>}</div>
      <h2><Link to={`/posts/${post.id}`}>{post.title || `${matchTypeLabels[recruitment.matchType]} · ${dateTime(recruitment.startAt)}`}</Link></h2>
      <p>{playTime(recruitment.startAt, recruitment.durationMinutes)}</p>
      {recruitment.access !== 'INVITEE' && (recruitment.externalCourt ? <><p>{recruitment.externalCourt.name} · {recruitment.externalCourt.district}, {recruitment.externalCourt.city}</p><small>{recruitment.externalCourt.address}</small><small>Thông tin sân do chủ kèo cung cấp</small></> : <p>Chưa có sân</p>)}
      <p>{recruitment.skillRange.min.name ?? 'Chưa rõ trình độ'} – {recruitment.skillRange.max.name ?? 'Chưa rõ trình độ'}</p>
      <Notice><strong>{recruitment.filledSlots}/{recruitment.capacity} chỗ · {recruitment.hasOpenSlots ? `Còn ${recruitment.capacity - recruitment.filledSlots} chỗ` : 'Đã ngừng nhận thêm'}</strong><small>{recruitment.matchType === 'GROUP' ? `Bao gồm chủ kèo và ${recruitment.companionCount} người đi cùng · Tối thiểu ${recruitment.minPlayers}` : 'Tổng số chỗ bao gồm chủ kèo.'}</small></Notice>
      {recruitment.costNote && <p>{recruitment.costNote}</p>}
      {detail && !!recruitment.members?.length && <div className="social-stack"><h3>Người chơi đã xác nhận</h3><div className="social-actions">{recruitment.members.map(member => <PlayerProfileButton key={member.playerId} playerId={member.playerId} displayName={member.displayName} showAvatar />)}</div></div>}
    </section>}
    {post.body && <p className="social-body">{post.body}</p>}
    {!!post.images.length && <div className={`social-images${post.images.length === 1 ? ' social-image-single' : ''}`}>{[...post.images].sort((a, b) => a.position - b.position).map((image, i) => <AuthorizedImage key={`${image.id}-${image.url}`} src={image.url} alt={`Ảnh bài viết ${i + 1}`} expandable />)}</div>}
    {post.isEdited && <small>Đã chỉnh sửa</small>}
    {recruitment && <div className="social-actions">{!detail && <Link className="social-button" to={`/posts/${post.id}`}>Xem chi tiết</Link>}{recruitment.viewerRelation === 'HOST' && <Link className="social-button social-primary" to={`/matchmaking/requests/${recruitment.requestId}`}>Quản lý kèo</Link>}</div>}
    <div className="social-summary"><span>{REACTIONS.filter(r => post.reactions.counts[r.type] > 0).map(r => r.emoji).join(' ')} {post.reactions.total} cảm xúc</span><Link to={`/posts/${post.id}#comments`}>{post.commentCount} bình luận</Link></div>
    {showReactions && <ReactionPicker value={post.reactions.viewerReaction} onChange={react} disabled={busy || disabled} />}
    <div className="social-actions"><button className={`social-button social-reaction${current ? ' social-success' : ''}`} type="button" aria-expanded={showReactions} aria-pressed={!!current} disabled={disabled} onClick={() => setShowReactions(value => !value)}>{current ? `${current.emoji} ${current.label}` : '👍 Thích'}</button><Link className="social-button" to={`/posts/${post.id}#comments`}>Bình luận</Link></div>
    {error && <Notice error>{error}</Notice>}
    {editing && <PostComposer post={post} type={post.type} skills={skills} onClose={() => setEditing(false)} onSaved={saved => { onChanged(saved); setEditing(false); }} />}
    {deleting && <Dialog title={post.type === 'MATCH_FINDING' ? 'Xóa bài tìm kèo?' : 'Xóa bài chia sẻ?'} busy={busy} onClose={() => setDeleting(false)}><div className="social-stack"><p>{post.type === 'MATCH_FINDING' ? startedActive ? 'Chỉ xóa được khi kèo đã kết thúc. Kèo đang diễn ra không thể xóa. Booking được giữ nguyên.' : 'Xóa bài đang hoạt động sẽ hủy kèo và đóng các lời mời đang chờ. Thành viên bị ảnh hưởng sẽ được thông báo. Booking được giữ nguyên; bạn tự quản lý booking riêng.' : 'Bài viết sẽ không còn hiển thị trong cộng đồng.'}</p>{error && <Notice error>{error}</Notice>}<div className="social-actions"><button className="social-button" disabled={busy} onClick={() => setDeleting(false)}>Giữ bài viết</button><button className="social-button social-danger-solid" disabled={busy} onClick={() => void act(() => socialApi.delete(post.id), true)}>{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</button></div></div></Dialog>}
  </article>;
}
