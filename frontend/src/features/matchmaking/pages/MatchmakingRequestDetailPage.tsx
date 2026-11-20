import { Link, useParams } from 'react-router-dom';
import { ChevronRight, FileText } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import { useVisibilityRefresh } from '../../../shared/hooks/useVisibilityRefresh';
import type { RecruitmentDetail } from '../types/recruitment';
import type { SkillLevel } from '../types/matchmaking';
import type { PostCard } from '../../social/types';
import { RecruitmentActions } from '../components/RecruitmentActions';
import { Notice } from '../../social/components/SocialUi';

const crumb = 'rounded-md hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Request authorization preserves management access after Admin hides a post. */
export function MatchmakingRequestDetailPage() {
  const { requestId } = useParams();
  const valid = /^\d+$/.test(requestId ?? '') && Number.isSafeInteger(Number(requestId)) && Number(requestId) > 0;
  const resource = useApiResource<{ data: RecruitmentDetail }>(valid ? `/api/v1/matchmaking-requests/${requestId}` : null);
  const skills = useApiResource<{ data: SkillLevel[] }>('/api/v1/skill-levels');
  const detail = resource.data?.data;
  const post = useApiResource<{ data: PostCard }>(detail?.postId ? `/api/v1/posts/${detail.postId}` : null);
  useVisibilityRefresh(resource.reload);
  return <PageContainer className="max-w-250">
    <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Link to="/feed" className={crumb}>Cộng đồng</Link><ChevronRight aria-hidden="true" className="size-3" /><Link to="/matchmaking" className={crumb}>Kèo của bạn</Link></nav>
    <PageHeader title="Quản lý kèo" description="Người chơi, lời mời và thông tin buổi chơi." actions={detail && !resource.error && post.data ? <Button asChild variant="outline" className="h-11"><Link to={`/posts/${detail.postId}`}><FileText aria-hidden="true" />Xem bài viết</Link></Button> : undefined} />
    {resource.loading && <div role="status" className="flex flex-col gap-3"><span className="text-sm text-muted-foreground">Đang tải kèo…</span><Skeleton className="h-64 rounded-2xl" /></div>}
    {(!valid || resource.error) && <Notice error>Không thể xem kèo này.{valid && <Button type="button" variant="outline" className="h-11" onClick={resource.reload}>Thử tải lại</Button>}</Notice>}
    {detail && !resource.error && <div className="flex flex-col gap-4">
      {post.error && <Notice warning>Nội dung bài viết không khả dụng. Bạn vẫn có thể thực hiện các thao tác quản lý được phép tại đây.</Notice>}
      <RecruitmentActions key={detail.id} requestId={detail.id} published={post.data ? !!post.data.data.publishedAt : undefined} skills={skills.data?.data ?? []} onChanged={() => { resource.reload(); post.reload(); }} />
    </div>}
  </PageContainer>;
}
