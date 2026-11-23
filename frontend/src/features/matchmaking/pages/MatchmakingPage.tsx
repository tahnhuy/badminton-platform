import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, Plus, RefreshCw, SearchX, X } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { EmptyState } from '@/components/common/empty-state';
import { Pagination } from '@/components/common/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import type { PageResult, PostCard } from '../../social/types';
import type { SkillLevel } from '../types/matchmaking';
import { PostComposer } from '../../social/components/PostComposer';
import { Notice } from '../../social/components/SocialUi';
import { matchTypeLabels } from '../../social/utils';
import { MatchDiscoveryCard } from '../components/MatchDiscoveryCard';
import { MatchDiscoveryFilters, type DiscoveryFilters } from '../components/MatchDiscoveryFilters';

const DISCOVERY_DEFAULTS: DiscoveryFilters = { hasOpenSlots: 'true', sort: 'upcoming' };
const FILTER_KEYS = ['matchType', 'date', 'timeFrom', 'timeTo', 'city', 'district', 'skillLevelId', 'hasOpenSlots', 'includeEnded', 'sort'];
const PAGE_SIZE = 10;
const chipLabels: Record<string, string> = { matchType: 'Loại kèo', date: 'Ngày', timeFrom: 'Từ giờ', timeTo: 'Đến giờ', city: 'Thành phố', district: 'Quận', skillLevelId: 'Trình độ', hasOpenSlots: 'Còn chỗ', includeEnded: 'Kèo đã kết thúc' };
const textLink = 'inline-flex min-h-9 items-center gap-1 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function LegacyRedirect({ params }: { params: URLSearchParams }) {
  const tab = params.get('tab');
  if (tab === 'requests') return <Navigate to="/matchmaking/activity?section=created" replace />;
  if (tab === 'applications') return <Navigate to="/matchmaking/activity?section=joined#applications" replace />;
  if (tab === 'invitations') return <Navigate to={`/matchmaking/activity?section=${params.get('direction') === 'SENT' ? 'created' : 'joined'}#invitations`} replace />;
  return null;
}

export function MatchmakingPage() {
  const [params] = useSearchParams();
  if (params.get('tab')) return <LegacyRedirect params={params} />;
  return <MatchDiscovery />;
}

function MatchDiscovery() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [composer, setComposer] = useState(false);
  const skills = useApiResource<{ data: SkillLevel[] }>('/api/v1/skill-levels');

  // Publish the default filter state in the URL so "Còn chỗ" is never hidden.
  useEffect(() => {
    const next = new URLSearchParams(params);
    let changed = false;
    for (const [key, value] of [...next.entries()]) {
      if (!FILTER_KEYS.includes(key) && key !== 'page') { next.delete(key); changed = true; }
      if (!value) { next.delete(key); changed = true; }
    }
    if (!next.has('hasOpenSlots')) { next.set('hasOpenSlots', 'true'); changed = true; }
    if (!next.has('sort')) { next.set('sort', 'upcoming'); changed = true; }
    if (changed) setParams(next, { replace: true });
  }, [params, setParams]);

  const filters: DiscoveryFilters = { hasOpenSlots: 'true', sort: 'upcoming', ...Object.fromEntries([...params.entries()].filter(([key, value]) => key !== 'page' && FILTER_KEYS.includes(key) && value)) };
  const parsedPage = Number(params.get('page') || 1);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const query = new URLSearchParams({ type: 'MATCH_FINDING', page: String(page), limit: String(PAGE_SIZE), ...filters });
  const feed = useApiResource<PageResult<PostCard>>(`/api/v1/posts?${query}`);
  const posts = (feed.data?.data ?? []).filter(post => post.type === 'MATCH_FINDING' && post.recruitment);
  const meta = feed.data?.meta;
  const totalPages = meta?.totalPages || 1;

  const apply = (value: DiscoveryFilters, options?: { replace?: boolean }) => {
    const next = new URLSearchParams({ ...value, sort: value.sort ?? filters.sort ?? 'upcoming' });
    setParams(next, options);
  };
  const removeFilter = (key: string) => {
    const next = new URLSearchParams(filters);
    next.delete(key);
    if (key === 'hasOpenSlots') next.set('hasOpenSlots', 'false');
    apply(Object.fromEntries(next.entries()));
  };
  const chipValue = (key: string, value: string) => value === 'true' ? 'Có' : value === 'false' ? 'Không' : key === 'matchType' ? matchTypeLabels[value as keyof typeof matchTypeLabels] ?? value : key === 'skillLevelId' ? skills.data?.data.find(skill => String(skill.id) === value)?.name ?? value : value;
  const hasFilters = Object.keys(filters).some(key => key !== 'sort');

  return <PageContainer className="max-w-275">
    <PageHeader title="Tìm đối thủ" description="Khám phá kèo còn chỗ, hợp lịch và trình độ của bạn." actions={<>
      <Button asChild variant="outline" className="h-11"><Link to="/matchmaking/activity">Hoạt động của tôi</Link></Button>
      <Button type="button" className="h-11" onClick={() => setComposer(true)}><Plus aria-hidden="true" />Đăng kèo</Button>
    </>} />
    <div className="flex flex-col gap-4">
      <section aria-label="Bộ lọc kèo"><MatchDiscoveryFilters value={filters} skills={skills.data?.data ?? []} onApply={apply} /></section>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{meta ? `${meta.total} kèo phù hợp` : 'Đang tải kèo…'}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">Sắp xếp
              <Select className="h-11 w-auto" value={filters.sort ?? 'upcoming'} onChange={value => { const next = new URLSearchParams(filters); next.set('sort', value); setParams(next); }} options={[
                { value: 'upcoming', label: 'Sắp diễn ra' },
                { value: 'newest', label: 'Mới đăng' },
              ]} />
            </label>
            <Button type="button" variant="ghost" className="h-11 text-primary" disabled={feed.loading} onClick={feed.reload}><RefreshCw aria-hidden="true" />Làm mới</Button>
          </div>
        </div>
        {hasFilters && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <span className="text-xs font-semibold text-muted-foreground">Đang lọc:</span>
          {Object.entries(filters).filter(([key]) => key !== 'sort').map(([key, value]) => {
            const label = `${chipLabels[key] ?? key}: ${chipValue(key, value)}`;
            return <Badge key={key} variant="success" className="gap-0 py-0 pl-2.5 pr-0">{label}
              <button type="button" aria-label={`Bỏ lọc ${label}`} className="flex size-8 items-center justify-center rounded-full hover:bg-success-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => removeFilter(key)}><X aria-hidden="true" /></button>
            </Badge>;
          })}
          <button type="button" className={textLink} onClick={() => apply(DISCOVERY_DEFAULTS)}>Xóa bộ lọc</button>
        </div>}
        {skills.error && <Notice error>Không thể tải danh mục trình độ.<Button type="button" variant="outline" className="h-11" onClick={skills.reload}>Tải lại trình độ</Button></Notice>}
        {feed.error && <Notice error>Không thể tải danh sách kèo. Vui lòng thử lại.<Button type="button" variant="outline" className="h-11" onClick={feed.reload}>Tải lại danh sách</Button></Notice>}
        {feed.loading && <section role="status" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm"><span className="text-sm text-muted-foreground">Đang tải kèo…</span><Skeleton className="h-7 w-1/2" /><Skeleton className="h-44" /></section>}
        {!feed.loading && !feed.error && posts.map(post => <MatchDiscoveryCard key={post.id} post={post} skills={skills.data?.data ?? []} onChanged={feed.reload} onDeleted={feed.reload} />)}
        {!feed.loading && !feed.error && !posts.length && <EmptyState icon={SearchX} title="Chưa có kèo phù hợp" description="Thử đổi khu vực, ngày chơi hoặc trình độ, hoặc đăng kèo mới để tìm người chơi." action={{ label: 'Đăng kèo', onClick: () => setComposer(true) }} />}
        {!feed.loading && !feed.error && posts.length > 0 && <p className="flex items-center gap-2 text-xs text-muted-foreground"><ClipboardList aria-hidden="true" className="size-4" />Chỉ hiển thị kèo công khai mà bạn có quyền xem.</p>}
        <Pagination page={page} totalPages={totalPages} disabled={feed.loading} onPageChange={next => { const changed = new URLSearchParams(params); if (next <= 1) changed.delete('page'); else changed.set('page', String(next)); setParams(changed); }} />
      </div>
    </div>
    {composer && <PostComposer type="MATCH_FINDING" skills={skills.data?.data ?? []} onClose={() => setComposer(false)} onSaved={post => { setComposer(false); navigate(`/posts/${post.id}`); }} />}
  </PageContainer>;
}
