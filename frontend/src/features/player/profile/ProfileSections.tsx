import { LockKeyhole, ShieldCheck, Star, Trophy } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/shared/utils/cn';
import type { PlayerProfile, RatingDimension } from './profile-api';
import { ProfileAvatarControl } from './ProfileAvatarControl';
import { ProfileAvatar } from './ProfileAvatar';

interface IdentityProps {
  profile: PlayerProfile; onUploaded: (url: string) => void; avatarUploadEnabled?: boolean;
  onReload?: () => void; uploadAvatar?: (file: File) => Promise<string>;
}
export function ProfileIdentity({ profile, onUploaded, uploadAvatar, avatarUploadEnabled, onReload }: IdentityProps) {
  return <section aria-label="Thông tin người chơi" className="overflow-hidden rounded-2xl border border-border bg-card text-center shadow-panel">
    <div aria-hidden="true" className="relative h-28 overflow-hidden bg-primary bg-linear-to-br from-primary to-brand-hover">
      <div className="absolute -right-5 -top-10 size-40 rounded-full border-20 border-primary-foreground/10" />
      <div className="absolute -left-6 top-12 h-20 w-60 -rotate-12 rounded-2xl border border-primary-foreground/20" />
    </div>
    <div className="relative flex flex-col items-center gap-4 px-5 pb-6 sm:px-6">
      <ProfileAvatar profile={profile} className="-mt-12" />
      <div className="min-w-0 max-w-full"><h2 className="break-words text-2xl font-extrabold tracking-tight">{profile.fullName}</h2><p className="mt-2 text-2xs font-semibold tracking-widest text-muted-foreground">HỒ SƠ NGƯỜI CHƠI</p></div>
      <Badge variant="success"><Trophy aria-hidden="true" />Trình độ {profile.skillLevel.name}</Badge>
      {avatarUploadEnabled ? <ProfileAvatarControl onUploaded={onUploaded} uploadAvatar={uploadAvatar} onReload={onReload} /> : <p className="text-sm text-muted-foreground">Đổi ảnh đại diện chưa khả dụng.</p>}
      {profile.stats ? <dl className="grid w-full grid-cols-3 gap-2 rounded-2xl bg-soft p-4">
        {[['Trận hoàn tất', profile.stats.matchesPlayed], ['Thắng', profile.stats.wins], ['Thua', profile.stats.losses]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 text-2xl font-bold text-primary">{value}</dd></div>)}
      </dl> : <p className="w-full rounded-lg border border-dashed border-border bg-soft p-4 text-sm text-muted-foreground">Thống kê chưa khả dụng</p>}
      <p className="text-xs leading-5 text-muted-foreground">Thắng/thua chỉ tính kết quả giải đấu.</p>
    </div>
  </section>;
}
export function ProfileSkill({ profile }: { profile: PlayerProfile }) {
  return <ContentPanel title="Trình độ thi đấu" icon={Trophy}>
    <Badge className="w-fit"><LockKeyhole aria-hidden="true" />Chỉ xem</Badge>
    <div className="flex items-center gap-4 rounded-2xl bg-accent p-4">
      <div className="flex size-16 shrink-0 items-center justify-center gap-1 rounded-2xl bg-card text-3xl font-extrabold text-primary">{profile.skillLevel.rank}<span className="text-xs font-medium text-muted-foreground">/ 6</span></div>
      <div><p className="text-2xs font-semibold tracking-wide text-muted-foreground">TRÌNH ĐỘ HIỆN TẠI</p><h3 className="mt-2 text-base font-bold">{profile.skillLevel.name}</h3></div>
    </div>
    <div className="flex gap-1.5" aria-label={`Trình độ ${profile.skillLevel.rank} trên 6 mức`}>
      {Array.from({ length: 6 }, (_, i) => <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < profile.skillLevel.rank ? 'bg-primary' : 'bg-muted')} />)}
    </div>
    {profile.skillLevel.description && <p className="text-sm leading-6 text-muted-foreground">{profile.skillLevel.description}</p>}
    <p className="flex items-start gap-2 rounded-lg bg-soft p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />Trình độ được quản lý theo quy tắc của nền tảng và không thể tự chỉnh sửa.</p>
  </ContentPanel>;
}
function RatingTile({ label, value, subtitle }: { label: string; value: RatingDimension; subtitle: string }) {
  const missing = value.notEnoughData || value.count < 3 || value.average === null;
  return <div className="flex flex-col gap-4 rounded-2xl border border-border bg-soft p-4 sm:p-5">
    <div className="flex items-center justify-between gap-2 text-sm font-semibold"><span>{label}</span><Star aria-hidden="true" className="size-4 text-caution" /></div>
    <div className="flex flex-wrap items-end gap-2">{missing ? <strong className="text-base text-muted-foreground">Chưa đủ đánh giá</strong> : <><strong className="text-3xl font-extrabold tracking-tight">{value.average!.toFixed(2)}</strong><span className="text-sm text-muted-foreground">/ 5.00</span></>}</div>
    <Progress aria-label={label} value={missing ? 0 : value.average! * 20} />
    <p className="text-xs text-muted-foreground">{value.count} lượt đánh giá <span>· {subtitle}</span></p>
  </div>;
}
export function ProfileRatings({ profile }: { profile: PlayerProfile }) {
  if (!profile.ratings) return <ContentPanel title="Đánh giá từ người chơi" icon={Trophy}>
    <p className="text-sm text-muted-foreground">Những đánh giá tổng hợp sau mỗi trận đấu</p>
    <div className="rounded-2xl border border-dashed border-border bg-soft p-5"><h3 className="text-base font-semibold">Đánh giá chưa khả dụng</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Đánh giá kỹ năng và thái độ sẽ xuất hiện khi tính năng này sẵn sàng.</p></div>
  </ContentPanel>;
  return <ContentPanel title="Đánh giá từ người chơi" icon={Trophy}>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Những đánh giá tổng hợp sau mỗi trận đấu</p><Badge>TỔNG HỢP</Badge></div>
    <div className="grid gap-4 sm:grid-cols-2"><RatingTile label="Kỹ năng thi đấu" value={profile.ratings.skill} subtitle="Kỹ năng" /><RatingTile label="Thái độ thi đấu" value={profile.ratings.attitude} subtitle="Thái độ" /></div>
    <p className="text-sm leading-6 text-muted-foreground">Điểm trung bình được hiển thị khi có ít nhất 3 lượt đánh giá. Danh tính người đánh giá luôn được giữ riêng tư.</p>
    <p className="flex items-start gap-2 rounded-lg bg-soft p-4 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><span>{profile.stats && !profile.stats.resultsAvailable && 'Chưa có kết quả giải đấu. '}Thắng/thua chỉ tính các trận trong giải đấu có kết quả, gồm WALKOVER; không tính BYE. Các trận giao lưu được tính vào tổng trận hoàn tất.</span></p>
  </ContentPanel>;
}
