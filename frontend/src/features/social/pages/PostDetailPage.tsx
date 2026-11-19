import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, FileX2 } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import { useVisibilityRefresh } from '../../../shared/hooks/useVisibilityRefresh';
import { useAuth } from '../../auth/use-auth';
import { RecruitmentActions } from '../../matchmaking/components/RecruitmentActions';
import type { SkillLevel } from '../../matchmaking/types/matchmaking';
import type { PostCard } from '../types';
import { SocialPostCard } from '../components/SocialPostCard';
import { PostComments } from '../components/PostComments';
import { Notice } from '../components/SocialUi';

export function PostDetailPage() {
  const { postId } = useParams(); const navigate = useNavigate(); const { user } = useAuth();
  const valid = /^\d+$/.test(postId ?? '') && Number.isSafeInteger(Number(postId)) && Number(postId) > 0;
  const resource = useApiResource<{ data: PostCard }>(valid ? `/api/v1/posts/${postId}` : null);
  const skills = useApiResource<{ data: SkillLevel[] }>('/api/v1/skill-levels'); useVisibilityRefresh(resource.reload);
  const post = resource.data?.data;
  return <PageContainer className="max-w-6xl">
    <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Link to="/feed" className="rounded-md hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cộng đồng</Link>
      <ChevronRight aria-hidden="true" className="size-3" /><span className="font-semibold text-foreground">Chi tiết bài viết</span>
    </nav>
    <PageHeader title={post?.type === 'MATCH_FINDING' ? 'Chi tiết kèo' : 'Chi tiết bài chia sẻ'} description="Cùng trao đổi và tìm người chơi phù hợp." />
    {resource.loading && <section role="status" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm"><span className="text-sm text-muted-foreground">Đang tải bài viết…</span><Skeleton className="h-7 w-1/2" /><Skeleton className="h-30" /></section>}
    {skills.error && <Notice error>Không thể tải danh mục trình độ.<Button type="button" variant="outline" className="h-11" onClick={skills.reload}>Tải lại trình độ</Button></Notice>}
    {(!valid || resource.error) && <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><FileX2 className="size-6" /></span>
      <h2 className="text-lg font-bold tracking-tight">Nội dung không khả dụng</h2><p className="max-w-md text-sm leading-6 text-muted-foreground">Bạn có thể tải lại hoặc quay về bảng tin để tiếp tục.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">{valid && <Button type="button" variant="outline" className="h-11" onClick={resource.reload}>Thử tải lại</Button>}<Button asChild className="h-11"><Link to="/feed">Về bảng tin</Link></Button></div>
    </section>}
    {post && !resource.error && <div className={post.recruitment ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]' : 'mx-auto flex w-full max-w-200 flex-col'}>
      <div className="flex min-w-0 flex-col gap-4"><SocialPostCard post={post} skills={skills.data?.data ?? []} detail onChanged={resource.reload} onDeleted={() => navigate('/feed', { replace: true })} />{!post.publishedAt && <Notice warning>Bài tìm kèo chưa công khai. Chỉ người có quyền mới xem được nội dung này.</Notice>}<PostComments key={post.id} postId={post.id} viewerId={Number(user?.id)} onCountChanged={resource.reload} /></div>
      {post.recruitment && <aside className="flex min-w-0 flex-col gap-4"><RecruitmentActions key={post.recruitment.requestId} requestId={post.recruitment.requestId} published={!!post.publishedAt} skills={skills.data?.data ?? []} onChanged={resource.reload} /></aside>}
    </div>}
  </PageContainer>;
}
