import { Link, useParams } from 'react-router-dom';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import { useVisibilityRefresh } from '../../../shared/hooks/useVisibilityRefresh';
import type { RecruitmentDetail } from '../types/recruitment';
import type { SkillLevel } from '../types/matchmaking';
import type { PostCard } from '../../social/types';
import { RecruitmentActions } from '../components/RecruitmentActions';
import { Notice } from '../../social/components/SocialUi';
import '../../social/social.css';

/** Request authorization preserves management access after Admin hides a post. */
export function MatchmakingRequestDetailPage() {
  const { requestId } = useParams();
  const valid = /^\d+$/.test(requestId ?? '') && Number.isSafeInteger(Number(requestId)) && Number(requestId) > 0;
  const resource = useApiResource<{ data: RecruitmentDetail }>(valid ? `/api/v1/matchmaking-requests/${requestId}` : null);
  const skills = useApiResource<{ data: SkillLevel[] }>('/api/v1/skill-levels');
  const detail = resource.data?.data;
  const post = useApiResource<{ data: PostCard }>(detail?.postId ? `/api/v1/posts/${detail.postId}` : null);
  useVisibilityRefresh(resource.reload);
  return <div className="social-page"><nav className="social-breadcrumb"><Link to="/feed">Cộng đồng</Link> / <Link to="/matchmaking">Kèo của bạn</Link></nav><header className="social-page-heading"><h1>Quản lý kèo</h1><p>Người chơi, lời mời và thông tin buổi chơi.</p></header>
    {resource.loading && <p role="status">Đang tải kèo…</p>}{(!valid || resource.error) && <Notice error>Không thể xem kèo này.{valid && <button className="social-button" onClick={resource.reload}>Thử tải lại</button>}</Notice>}
    {detail && !resource.error && <div className="social-management"><RecruitmentActions key={detail.id} requestId={detail.id} published={post.data ? !!post.data.data.publishedAt : undefined} skills={skills.data?.data ?? []} onChanged={() => { resource.reload(); post.reload(); }} />{post.data && <Link className="social-button" to={`/posts/${detail.postId}`}>Xem bài viết</Link>}{post.error && <Notice>Nội dung bài viết không khả dụng. Bạn vẫn có thể thực hiện các thao tác quản lý được phép tại đây.</Notice>}</div>}
  </div>;
}
