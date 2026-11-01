import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApiResource } from '../../../shared/hooks/useApiResource';
import { useOwnPlayerProfile } from '../../player/profile/profile-context';
import type { SkillLevel, MatchmakingRequestSummary, Paginated } from '../../matchmaking/types/matchmaking';
import type { FeedFilters as Filters, PostCard } from '../types';
import { useFeed } from '../hooks/useFeed';
import { FeedFilters } from '../components/FeedFilters';
import { PostComposer } from '../components/PostComposer';
import { SocialPostCard } from '../components/SocialPostCard';
import { AuthorRow, Notice } from '../components/SocialUi';
import { Dialog } from '../../../components/common/Dialog';
import { FilterToolbar } from '../../../components/common/FilterToolbar';
import { matchTypeLabels } from '../utils';
import '../social.css';

const filterKeys = ['type', 'matchType', 'date', 'timeFrom', 'timeTo', 'city', 'district', 'skillLevelId', 'hasOpenSlots', 'includeEnded'];
export function FeedPage() {
  const [params, setParams] = useSearchParams(); const navigate = useNavigate();
  const filters: Filters = Object.fromEntries([...params.entries()].filter(([key, value]) => filterKeys.includes(key) && value));
  const feed = useFeed(filters); const { profile } = useOwnPlayerProfile();
  const skills = useApiResource<{ data: SkillLevel[] }>('/api/v1/skill-levels');
  const requests = useApiResource<Paginated<MatchmakingRequestSummary>>('/api/v1/matchmaking-requests?status=OPEN&limit=3');
  const [composer, setComposer] = useState<PostCard['type'] | null>(null); const [mobileFilters, setMobileFilters] = useState(false);
  const apply = (value: Filters) => { setParams(value); setMobileFilters(false); };
  const saved = (post: PostCard) => { setComposer(null); if (!post.publishedAt) navigate(`/posts/${post.id}`); else feed.refresh(); requests.reload(); };
  const filterContent = <FeedFilters key={params.toString()} value={filters} skills={skills.data?.data ?? []} onApply={apply} />;
  const chipValue = (key: string, value: string) => value === 'true' ? 'Có' : value === 'FREE' ? 'Chia sẻ' : value === 'MATCH_FINDING' ? 'Tìm người chơi' : key === 'matchType' ? matchTypeLabels[value as keyof typeof matchTypeLabels] ?? value : key === 'skillLevelId' ? skills.data?.data.find(skill => String(skill.id) === value)?.name ?? value : value;
  return <div className="social-page"><nav className="social-breadcrumb" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link> / Cộng đồng / Bảng tin cộng đồng</nav><header className="social-page-heading"><h1>Bảng tin cộng đồng</h1><p>Chia sẻ chuyện trên sân, tìm người chơi cùng khu vực.</p></header>
    <div className="social-feed-layout"><aside className="social-filter-rail">{filterContent}</aside><div className="social-stack social-feed-main">
      <section className="social-card"><div className="social-author"><span className="social-avatar">{profile?.fullName?.charAt(0) ?? 'N'}</span><button className="social-compose-prompt" onClick={() => setComposer('FREE')}>{profile?.fullName?.split(' ').at(-1) ?? 'Bạn'} muốn chia sẻ điều gì hôm nay?</button></div><div className="social-actions"><button className="social-button" onClick={() => setComposer('FREE')}>Chia sẻ</button><button className="social-button social-primary" onClick={() => setComposer('MATCH_FINDING')}>Tìm người chơi</button></div></section>
      <div className="social-feed-tools"><button className="social-button social-mobile-filter" onClick={() => setMobileFilters(true)}>Lọc bài viết</button><button className="social-text-button" disabled={feed.loading} onClick={() => { feed.refresh(); requests.reload(); }}>Làm mới bảng tin</button></div>
      {!!Object.keys(filters).length && <FilterToolbar activeChips={Object.entries(filters).map(([key, value]) => ({ id: key, label: `${({ type: 'Loại bài', matchType: 'Loại kèo', date: 'Ngày', timeFrom: 'Từ giờ', timeTo: 'Đến giờ', city: 'Thành phố', district: 'Quận', skillLevelId: 'Trình độ', hasOpenSlots: 'Còn chỗ', includeEnded: 'Kèo đã kết thúc' } as Record<string, string>)[key]}: ${chipValue(key, value)}`, onRemove: () => apply(Object.fromEntries(Object.entries(filters).filter(([field]) => field !== key))) }))} onClearAll={() => apply({})} />}
      <p className="social-feed-caption">Bài công khai • Mới nhất</p>
      {skills.error && <Notice error>Không thể tải danh mục trình độ.<button className="social-button" onClick={skills.reload}>Tải lại trình độ</button></Notice>}
      {feed.posts.map(post => <SocialPostCard key={post.id} post={post} skills={skills.data?.data ?? []} onChanged={feed.replace} onDeleted={feed.remove} />)}
      {feed.loading && <section className="social-card social-skeleton" role="status">Đang tải bài viết…<span /><span /><span /></section>}
      {feed.error && <Notice error>{feed.error}<button className="social-button" onClick={() => feed.meta ? void feed.more() : feed.refresh()}>Thử tải lại bảng tin</button></Notice>}
      {!feed.loading && !feed.error && !feed.posts.length && <section className="social-card social-empty"><h2>{Object.keys(filters).length ? 'Không có bài viết phù hợp' : 'Cộng đồng đang chờ câu chuyện của bạn'}</h2><p>{Object.keys(filters).length ? 'Thử thay đổi hoặc xóa bộ lọc để xem thêm bài viết.' : 'Chia sẻ buổi tập hoặc tạo kèo để tìm người chơi cùng.'}</p><button className="social-button" onClick={() => Object.keys(filters).length ? apply({}) : setComposer('FREE')}>{Object.keys(filters).length ? 'Xóa bộ lọc' : 'Viết bài đầu tiên'}</button></section>}
      {feed.meta && feed.meta.page < feed.meta.totalPages && <button className="social-button" disabled={feed.loading} onClick={() => void feed.more()}>Xem thêm bài viết</button>}
    </div><aside className="social-stack social-info-rail"><section className="social-card"><h2>Hồ sơ của bạn</h2>{profile && <AuthorRow person={{ id: profile.userId, displayName: profile.fullName, avatarUrl: profile.avatarUrl }} subtitle={profile.skillLevel.name} />}<Link className="social-button" to="/profile">Xem hồ sơ</Link></section>
      <section className="social-card"><h2>Kèo của bạn</h2>{requests.loading && <p role="status">Đang tải kèo…</p>}{requests.error && <Notice error>{requests.error}<button className="social-button" onClick={requests.reload}>Tải lại kèo của bạn</button></Notice>}{requests.data?.data.map(request => <div className="social-stack" key={request.id}><span className="social-badge">Đang tuyển</span><p>{request.preferredDate ?? 'Xem ngày trong chi tiết'} · {request.preferredStartTime?.slice(0, 5) ?? 'Xem giờ trong chi tiết'}</p><Link className="social-button" to={`/matchmaking/requests/${request.id}`}>Quản lý kèo #{request.id}</Link></div>)}{requests.data?.data.length === 0 && <p>Bạn chưa có kèo đang tuyển.</p>}<Link className="social-text-button" to="/matchmaking">Xem tất cả kèo của bạn</Link><Link className="social-text-button" to="/matchmaking/invitations">Lời mời của bạn</Link><Link className="social-text-button" to="/matchmaking?tab=applications">Yêu cầu tham gia đã gửi</Link></section>
      <section className="social-card"><h2>Cùng giữ sân chơi tích cực</h2><p className="social-muted">Tôn trọng người chơi, chia sẻ đúng nội dung. Không công khai thông tin riêng tư của người khác.</p></section>
    </aside></div>
    {mobileFilters && <Dialog title="Bộ lọc bảng tin" onClose={() => setMobileFilters(false)}>{filterContent}</Dialog>}
    {composer && <PostComposer type={composer} skills={skills.data?.data ?? []} onClose={() => setComposer(null)} onSaved={saved} />}
  </div>;
}
