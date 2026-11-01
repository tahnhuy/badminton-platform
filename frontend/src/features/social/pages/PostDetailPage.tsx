import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import { useVisibilityRefresh } from '../../../shared/hooks/useVisibilityRefresh';
import { useAuth } from '../../auth/use-auth';
import { RecruitmentActions } from '../../matchmaking/components/RecruitmentActions';
import type { SkillLevel } from '../../matchmaking/types/matchmaking';
import type { PostCard } from '../types';
import { SocialPostCard } from '../components/SocialPostCard';
import { PostComments } from '../components/PostComments';
import { Notice } from '../components/SocialUi';
import '../social.css';

export function PostDetailPage() {
  const { postId } = useParams(); const navigate = useNavigate(); const { user } = useAuth();
  const valid = /^\d+$/.test(postId ?? '') && Number.isSafeInteger(Number(postId)) && Number(postId) > 0;
  const resource = useApiResource<{ data: PostCard }>(valid ? `/api/v1/posts/${postId}` : null);
  const skills = useApiResource<{ data: SkillLevel[] }>('/api/v1/skill-levels'); useVisibilityRefresh(resource.reload);
  const post = resource.data?.data;
  return <div className="social-page"><nav className="social-breadcrumb" aria-label="Đường dẫn"><Link to="/feed">Cộng đồng</Link> / Chi tiết bài viết</nav><header className="social-page-heading"><h1>{post?.type === 'MATCH_FINDING' ? 'Chi tiết kèo' : 'Chi tiết bài chia sẻ'}</h1><p>Cùng trao đổi và tìm người chơi phù hợp.</p></header>
    {resource.loading && <section className="social-card" role="status">Đang tải bài viết…</section>}
    {skills.error && <Notice error>Không thể tải danh mục trình độ.<button className="social-button" onClick={skills.reload}>Tải lại trình độ</button></Notice>}
    {(!valid || resource.error) && <section className="social-card social-empty"><h2>Nội dung không khả dụng</h2><p>Bạn có thể tải lại hoặc quay về bảng tin để tiếp tục.</p><div className="social-actions">{valid && <button className="social-button" onClick={resource.reload}>Thử tải lại</button>}<Link className="social-button social-primary" to="/feed">Về bảng tin</Link></div></section>}
    {post && !resource.error && <div className="social-detail-layout"><div className="social-stack"><SocialPostCard post={post} skills={skills.data?.data ?? []} detail onChanged={resource.reload} onDeleted={() => navigate('/feed', { replace: true })} />{!post.publishedAt && <Notice>Bài tìm kèo chưa công khai. Chỉ người có quyền mới xem được nội dung này.</Notice>}<PostComments key={post.id} postId={post.id} viewerId={Number(user?.id)} onCountChanged={resource.reload} /></div>
      {post.recruitment && <aside className="social-stack"><RecruitmentActions key={post.recruitment.requestId} requestId={post.recruitment.requestId} published={!!post.publishedAt} skills={skills.data?.data ?? []} onChanged={resource.reload} /></aside>}
    </div>}
  </div>;
}
