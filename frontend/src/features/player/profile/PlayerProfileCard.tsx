import { Badge } from '@/components/ui/badge';
import type { PlayerProfile, RatingDimension } from './profile-api';
import { ProfileAvatar } from './ProfileAvatar';

function Rating({ label, value }: { label: string; value: RatingDimension }) {
  const insufficient = value.notEnoughData || value.count < 3 || value.average === null;
  return <div className="rounded-lg bg-soft p-4"><dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="mt-2 text-base font-bold">{insufficient ? 'Chưa đủ đánh giá' : `${value.average!.toFixed(2)} / 5`}</dd>
    <span className="mt-2 block text-xs text-muted-foreground">{value.count} lượt đánh giá</span></div>;
}
export function PlayerProfileCard({ profile }: { profile: PlayerProfile }) {
  return <section className="flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-card p-5" aria-label="Thông tin người chơi">
    <div className="flex flex-col items-center gap-3 text-center">
      <ProfileAvatar profile={profile} />
      <h2 className="max-w-full break-words text-2xl font-extrabold tracking-tight">{profile.fullName}</h2>
      <Badge variant="success">{profile.skillLevel.name}</Badge>
      {profile.skillLevel.description && <p className="text-sm leading-6 text-muted-foreground">{profile.skillLevel.description}</p>}
    </div>
    {profile.ratings ? <dl className="grid gap-3 sm:grid-cols-2"><Rating label="Kỹ năng" value={profile.ratings.skill} /><Rating label="Thái độ" value={profile.ratings.attitude} /></dl> : <p className="rounded-lg bg-soft p-4 text-sm text-muted-foreground">Đánh giá chưa khả dụng</p>}
    {profile.stats ? <dl className="grid grid-cols-3 gap-2 rounded-lg bg-accent p-4 text-center">
      {[['Trận hoàn tất', profile.stats.matchesPlayed], ['Thắng', profile.stats.wins], ['Thua', profile.stats.losses]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 text-2xl font-bold text-primary">{value}</dd></div>)}
    </dl> : <p className="rounded-lg bg-soft p-4 text-sm text-muted-foreground">Thống kê chưa khả dụng</p>}
    {profile.stats && !profile.stats.resultsAvailable && <p className="text-sm text-muted-foreground">Chưa có kết quả giải đấu.</p>}
    <p className="text-xs leading-5 text-muted-foreground">Thắng/thua chỉ tính các trận trong giải đấu có kết quả, gồm xử thắng WALKOVER; không tính BYE.</p>
  </section>;
}
