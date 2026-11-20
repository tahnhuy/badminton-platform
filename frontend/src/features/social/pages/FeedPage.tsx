import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Newspaper, PenLine, RefreshCw, SearchX, ShieldCheck, SlidersHorizontal, Swords, UserRound, X } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { ContentPanel } from '@/components/common/content-panel';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import { useOwnPlayerProfile } from '../../player/profile/profile-context';
import type { SkillLevel, MatchmakingRequestSummary, Paginated } from '../../matchmaking/types/matchmaking';
import type { FeedFilters as Filters, PostCard } from '../types';
import { useFeed } from '../hooks/useFeed';
import { FeedFilters } from '../components/FeedFilters';
import { PostComposer } from '../components/PostComposer';
import { SocialPostCard } from '../components/SocialPostCard';
import { AuthorRow, Notice } from '../components/SocialUi';
import { matchTypeLabels, recruitmentStatusLabels } from '../utils';

const filterKeys = ['type', 'matchType', 'date', 'timeFrom', 'timeTo', 'city', 'district', 'skillLevelId', 'hasOpenSlots', 'includeEnded'];
const filterLabels: Record<string, string> = { type: 'Loại bài', matchType: 'Loại kèo', date: 'Ngày', timeFrom: 'Từ giờ', timeTo: 'Đến giờ', city: 'Thành phố', district: 'Quận', skillLevelId: 'Trình độ', hasOpenSlots: 'Còn chỗ', includeEnded: 'Kèo đã kết thúc' };
const textLink = 'inline-flex min-h-9 items-center gap-1 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function FeedPage() {
  const [params, setParams] = useSearchParams(); const navigate = useNavigate();
  const filters: Filters = Object.fromEntries([...params.entries()].filter(([key, value]) => filterKeys.includes(key) && value));
  const feed = useFeed(filters); const { profile } = useOwnPlayerProfile();
  const skills = useApiResource<{ data: SkillLevel[] }>('/api/v1/skill-levels');
  const requests = useApiResource<Paginated<MatchmakingRequestSummary>>('/api/v1/matchmaking-requests?limit=3');
  const [composer, setComposer] = useState<PostCard['type'] | null>(null); const [mobileFilters, setMobileFilters] = useState(false);
  const apply = (value: Filters) => { setParams(value); setMobileFilters(false); };
  const saved = (post: PostCard) => { setComposer(null); if (!post.publishedAt) navigate(`/posts/${post.id}`); else feed.refresh(); requests.reload(); };
  const filterContent = (showTitle: boolean) => <FeedFilters key={params.toString()} value={filters} skills={skills.data?.data ?? []} onApply={apply} showTitle={showTitle} />;
  const chipValue = (key: string, value: string) => value === 'true' ? 'Có' : value === 'FREE' ? 'Chia sẻ' : value === 'MATCH_FINDING' ? 'Tìm người chơi' : key === 'matchType' ? matchTypeLabels[value as keyof typeof matchTypeLabels] ?? value : key === 'skillLevelId' ? skills.data?.data.find(skill => String(skill.id) === value)?.name ?? value : value;
  const hasFilters = !!Object.keys(filters).length;
  return <PageContainer>
    <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Link to="/" className="rounded-md hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Trang chủ</Link>
      <ChevronRight aria-hidden="true" className="size-3" /><span>Cộng đồng</span><ChevronRight aria-hidden="true" className="size-3" /><span className="font-semibold text-foreground">Bảng tin cộng đồng</span>
    </nav>
    <PageHeader title="Bảng tin cộng đồng" description="Chia sẻ chuyện trên sân, tìm người chơi cùng khu vực." />
    <div className="grid items-start gap-6 md:grid-cols-[13.75rem_minmax(0,1fr)] xl:grid-cols-[14.5rem_minmax(0,1fr)_16rem]">
      <aside className="hidden rounded-2xl border border-border bg-card p-5 shadow-sm md:sticky md:top-24 md:block">{filterContent(true)}</aside>
      <div className="flex min-w-0 flex-col gap-4">
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{profile?.fullName?.charAt(0) ?? 'N'}</span>
            <button type="button" className="min-h-11 flex-1 rounded-full border border-input bg-soft px-4 text-left text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setComposer('FREE')}>{profile?.fullName?.split(' ').at(-1) ?? 'Bạn'} muốn chia sẻ điều gì hôm nay?</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setComposer('FREE')}><PenLine aria-hidden="true" />Chia sẻ</Button>
            <Button type="button" className="h-11" onClick={() => setComposer('MATCH_FINDING')}><Swords aria-hidden="true" />Tìm người chơi</Button>
          </div>
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Dialog open={mobileFilters} onOpenChange={setMobileFilters}>
            <DialogTrigger asChild><Button type="button" variant="outline" className="h-11 md:hidden"><SlidersHorizontal aria-hidden="true" />Lọc bài viết</Button></DialogTrigger>
            <DialogContent variant="sheet" aria-describedby={undefined}><DialogTitle className="mb-4">Bộ lọc bảng tin</DialogTitle>{filterContent(false)}</DialogContent>
          </Dialog>
          <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Newspaper aria-hidden="true" className="size-4" />Bài công khai • Mới nhất</p>
          <Button type="button" variant="ghost" className="h-11 text-primary" disabled={feed.loading} onClick={() => { feed.refresh(); requests.reload(); }}><RefreshCw aria-hidden="true" />Làm mới bảng tin</Button>
        </div>
        {hasFilters && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <span className="text-xs font-semibold text-muted-foreground">Đang lọc:</span>
          {Object.entries(filters).map(([key, value]) => {
            const label = `${filterLabels[key]}: ${chipValue(key, value)}`;
            return <Badge key={key} variant="success" className="gap-0 py-0 pl-2.5 pr-0">{label}
              <button type="button" aria-label={`Bỏ lọc ${label}`} className="flex size-8 items-center justify-center rounded-full hover:bg-success-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => apply(Object.fromEntries(Object.entries(filters).filter(([field]) => field !== key)))}><X aria-hidden="true" /></button>
            </Badge>;
          })}
          <button type="button" className={textLink} onClick={() => apply({})}>Xóa tất cả</button>
        </div>}
        {skills.error && <Notice error>Không thể tải danh mục trình độ.<Button type="button" variant="outline" className="h-11" onClick={skills.reload}>Tải lại trình độ</Button></Notice>}
        {feed.posts.map(post => <SocialPostCard key={post.id} post={post} skills={skills.data?.data ?? []} onChanged={feed.replace} onDeleted={feed.remove} />)}
        {feed.loading && <section role="status" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm"><span className="text-sm text-muted-foreground">Đang tải bài viết…</span><Skeleton className="h-7 w-1/2" /><Skeleton className="h-7" /><Skeleton className="h-30" /></section>}
        {feed.error && <Notice error>{feed.error}<Button type="button" variant="outline" className="h-11" onClick={() => feed.meta ? void feed.more() : feed.refresh()}>Thử tải lại bảng tin</Button></Notice>}
        {!feed.loading && !feed.error && !feed.posts.length && (hasFilters
          ? <EmptyState icon={SearchX} title="Không có bài viết phù hợp" description="Thử thay đổi hoặc xóa bộ lọc để xem thêm bài viết." action={{ label: 'Xóa bộ lọc', onClick: () => apply({}) }} />
          : <EmptyState icon={PenLine} title="Cộng đồng đang chờ câu chuyện của bạn" description="Chia sẻ buổi tập hoặc tạo kèo để tìm người chơi cùng." action={{ label: 'Viết bài đầu tiên', onClick: () => setComposer('FREE') }} />)}
        {feed.meta && feed.meta.page < feed.meta.totalPages && <Button type="button" variant="outline" className="h-11 self-center" disabled={feed.loading} onClick={() => void feed.more()}>Xem thêm bài viết</Button>}
      </div>
      <aside className="grid min-w-0 gap-4 sm:grid-cols-2 md:col-start-2 md:grid-cols-2 xl:col-start-auto xl:grid-cols-1">
        <ContentPanel title="Hồ sơ của bạn" icon={UserRound}>
          {profile && <AuthorRow person={{ id: profile.userId, displayName: profile.fullName, avatarUrl: profile.avatarUrl }} subtitle={profile.skillLevel.name} />}
          <Button asChild variant="outline" className="h-11"><Link to="/profile">Xem hồ sơ</Link></Button>
        </ContentPanel>
        <ContentPanel title="Kèo của bạn" icon={Swords}>
          {requests.loading && <p role="status" className="text-sm text-muted-foreground">Đang tải kèo…</p>}
          {requests.error && <Notice error>{requests.error}<Button type="button" variant="outline" className="h-11" onClick={requests.reload}>Tải lại kèo của bạn</Button></Notice>}
          {requests.data?.data.map(request => <div key={request.id} className="flex flex-col items-start gap-2 border-b border-border pb-3 last:border-b-0">
            <Badge variant="success">{recruitmentStatusLabels[request.status] ?? request.status}</Badge>
            <p className="text-sm">{request.preferredDate ?? 'Xem ngày trong chi tiết'} · {request.preferredStartTime?.slice(0, 5) ?? 'Xem giờ trong chi tiết'}</p>
            <Button asChild variant="outline" className="h-11"><Link to={`/matchmaking/requests/${request.id}`}>{request.isOwner ? 'Quản lý kèo' : 'Xem kèo'} #{request.id}</Link></Button>
          </div>)}
          {requests.data?.data.length === 0 && <p className="text-sm text-muted-foreground">Bạn chưa tạo hoặc tham gia kèo nào.</p>}
          <div className="flex flex-col items-start">
            <Link className={textLink} to="/matchmaking">Xem tất cả kèo của bạn</Link>
            <Link className={textLink} to="/matchmaking/invitations">Lời mời của bạn</Link>
            <Link className={textLink} to="/matchmaking?tab=applications">Yêu cầu tham gia đã gửi</Link>
          </div>
        </ContentPanel>
        <ContentPanel title="Cùng giữ sân chơi tích cực" icon={ShieldCheck}>
          <p className="text-sm leading-6 text-muted-foreground">Tôn trọng người chơi, chia sẻ đúng nội dung. Không công khai thông tin riêng tư của người khác.</p>
        </ContentPanel>
      </aside>
    </div>
    {composer && <PostComposer type={composer} skills={skills.data?.data ?? []} onClose={() => setComposer(null)} onSaved={saved} />}
  </PageContainer>;
}
