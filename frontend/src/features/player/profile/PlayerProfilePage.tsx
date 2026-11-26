import { ChevronRight, Home } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOwnPlayerProfile } from './profile-context';
import { ProfileIdentity, ProfileSkill, ProfileRatings } from './ProfileSections';
import { ProfileNameForm } from './ProfileNameForm';
import { useHasOwnSkillSurvey } from './use-has-own-skill-survey';
import { ProfileTournaments } from '../../tournaments/components/ProfileTournaments';
import { SkillRatingCard } from '../../tournaments/components/SkillRatingCard';

export function PlayerProfilePage() {
  const state = useOwnPlayerProfile();
  const { profile, loading, error, retry, acceptUpdatedProfile, acceptAvatar, isPreview, saveName, uploadAvatar, avatarUploadEnabled } = state;
  const hasSurveyResult = useHasOwnSkillSurvey(Boolean(profile) && !isPreview);
  return <PageContainer>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-2">
        <a href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Home aria-hidden="true" className="size-4" />Trang chủ</a>
        <ChevronRight aria-hidden="true" className="size-3" /><span>Tài khoản của tôi</span><ChevronRight aria-hidden="true" className="size-3" /><strong>Hồ sơ cá nhân</strong>
      </nav><Badge>{isPreview ? 'Bản xem thử giao diện' : 'Hồ sơ người chơi'}</Badge>
    </div>
    <PageHeader title="Hồ sơ cá nhân" description="Cập nhật thông tin hiển thị và theo dõi hành trình thi đấu của bạn cùng SmashPro." actions={<Badge variant="success">PLAYER PROFILE</Badge>} />
    {isPreview && <div className="rounded-2xl border border-caution/20 bg-caution-bg p-4 text-sm leading-6"><strong>DỮ LIỆU MẪU</strong><p>Bản xem thử hồ sơ. Bạn có thể thử đổi tên và ảnh; thay đổi chỉ áp dụng cho bản xem thử.</p></div>}
    {loading && <div role="status" className="flex flex-col gap-4"><span>Đang tải hồ sơ…</span><Skeleton className="h-72 rounded-2xl" /></div>}
    {error && <div role="alert" className="rounded-2xl border border-danger/20 bg-card p-6"><h2 className="text-lg font-bold">Chưa thể tải hồ sơ</h2><p className="my-4 text-sm text-muted-foreground">{error}</p><Button variant="outline" onClick={retry}>Thử lại</Button></div>}
    {profile && <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col gap-6"><ProfileIdentity profile={profile} onUploaded={acceptAvatar} uploadAvatar={uploadAvatar} avatarUploadEnabled={avatarUploadEnabled} onReload={retry} /><ProfileSkill profile={profile} showSurveyResultLink={hasSurveyResult} />{!isPreview && <SkillRatingCard />}</aside>
      <div className="flex min-w-0 flex-col gap-6"><ProfileNameForm profile={profile} onSaved={acceptUpdatedProfile} onReload={retry} saveName={saveName} isPreview={isPreview} /><ProfileRatings profile={profile} />{!isPreview && <ProfileTournaments playerId={profile.userId} />}</div>
    </div>}
  </PageContainer>;
}
