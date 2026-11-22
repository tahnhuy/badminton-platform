import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, ImagePlus, Newspaper, Palette, PenLine, RefreshCw } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import { useOwnPlayerProfile } from '../../player/profile/profile-context';
import type { SkillLevel } from '../../matchmaking/types/matchmaking';
import type { PostCard } from '../types';
import { useFeed } from '../hooks/useFeed';
import { PostComposer } from '../components/PostComposer';
import { SocialPostCard } from '../components/SocialPostCard';
import { Notice } from '../components/SocialUi';

/** Community is share-only; match-finding posts live in /matchmaking. */
const freeOnly = { type: 'FREE' };

export function FeedPage() {
  const [params, setParams] = useSearchParams(); const navigate = useNavigate();
  const feed = useFeed(freeOnly); const { profile } = useOwnPlayerProfile();
  const skills = useApiResource<{ data: SkillLevel[] }>('/api/v1/skill-levels');
  const [composer, setComposer] = useState(false);
  const [withBackground, setWithBackground] = useState(false);

  // Old feed URLs could carry match-finding filters/type. Drop them so a link never
  // brings MATCH_FINDING back into Community.
  useEffect(() => {
    if ([...params.keys()].length > 0) setParams({}, { replace: true });
  }, [params, setParams]);

  const saved = (post: PostCard) => { setComposer(false); setWithBackground(false); if (!post.publishedAt) navigate(`/posts/${post.id}`); else feed.refresh(); };
  return <PageContainer className="max-w-200">
    <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Link to="/" className="rounded-md hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Trang chủ</Link>
      <ChevronRight aria-hidden="true" className="size-3" /><span>Cộng đồng</span><ChevronRight aria-hidden="true" className="size-3" /><span className="font-semibold text-foreground">Bảng tin cộng đồng</span>
    </nav>
    <PageHeader title="Bảng tin cộng đồng" description="Chia sẻ câu chuyện, khoảnh khắc và kinh nghiệm trên sân." />
    <div className="flex min-w-0 flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{profile?.fullName?.charAt(0) ?? 'N'}</span>
          <button type="button" className="min-h-11 flex-1 rounded-full border border-input bg-soft px-4 text-left text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setComposer(true)}>{profile?.fullName?.split(' ').at(-1) ?? 'Bạn'} muốn chia sẻ điều gì hôm nay?</button>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-border pt-3"><Button type="button" variant="ghost" className="h-11" onClick={() => setComposer(true)}><ImagePlus aria-hidden="true" className="text-primary" />Ảnh</Button><Button type="button" variant="ghost" className="h-11" onClick={() => { setWithBackground(true); setComposer(true); }}><Palette aria-hidden="true" className="text-primary" />Bài viết có nền</Button></div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Newspaper aria-hidden="true" className="size-4" />Bài chia sẻ công khai • Mới nhất</p>
        <Button type="button" variant="ghost" className="h-11 text-primary" disabled={feed.loading} onClick={feed.refresh}><RefreshCw aria-hidden="true" />Làm mới bảng tin</Button>
      </div>
      {skills.error && <Notice error>Không thể tải danh mục trình độ.<Button type="button" variant="outline" className="h-11" onClick={skills.reload}>Tải lại trình độ</Button></Notice>}
      {feed.posts.map(post => <SocialPostCard key={post.id} post={post} skills={skills.data?.data ?? []} onChanged={feed.replace} onDeleted={feed.remove} />)}
      {feed.loading && <section role="status" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm"><span className="text-sm text-muted-foreground">Đang tải bài viết…</span><Skeleton className="h-7 w-1/2" /><Skeleton className="h-7" /><Skeleton className="h-30" /></section>}
      {feed.error && <Notice error>{feed.error}<Button type="button" variant="outline" className="h-11" onClick={() => feed.meta ? void feed.more() : feed.refresh()}>Thử tải lại bảng tin</Button></Notice>}
      {!feed.loading && !feed.error && !feed.posts.length && <EmptyState icon={PenLine} title="Cộng đồng đang chờ câu chuyện của bạn" description="Chia sẻ buổi tập, khoảnh khắc hoặc kinh nghiệm chơi cầu lông." action={{ label: 'Viết bài đầu tiên', onClick: () => setComposer(true) }} />}
      {feed.meta && feed.meta.page < feed.meta.totalPages && <Button type="button" variant="outline" className="h-11 self-center" disabled={feed.loading} onClick={() => void feed.more()}>Xem thêm bài viết</Button>}
    </div>
    {composer && <PostComposer type="FREE" initialBackground={withBackground ? 'forest' : null} skills={skills.data?.data ?? []} onClose={() => { setComposer(false); setWithBackground(false); }} onSaved={saved} />}
  </PageContainer>;
}
