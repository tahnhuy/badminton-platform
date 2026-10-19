import type { PlayerProfile, RatingDimension } from './profile-api';
import './profile.css';

function Rating({ label, value }: { label: string; value: RatingDimension }) {
  const insufficient = value.notEnoughData || value.count < 3 || value.average === null;
  return <div className="profile-metric"><dt>{label}</dt>
    <dd>{insufficient ? 'Chưa đủ đánh giá' : `${value.average!.toFixed(2)} / 5`}</dd>
    <span>{value.count} lượt đánh giá</span></div>;
}
export function PlayerProfileCard({ profile }: { profile: PlayerProfile }) {
  return <section className="profile-card" aria-label="Thông tin người chơi">
    <div className="profile-identity">
      {profile.avatarUrl ? <img className="profile-avatar" src={profile.avatarUrl} alt={`Ảnh đại diện ${profile.fullName}`} />
        : <div className="profile-avatar profile-initial" aria-label="Chưa có ảnh đại diện">{profile.fullName.slice(0, 1).toUpperCase()}</div>}
      <h2>{profile.fullName}</h2><span className="profile-skill">{profile.skillLevel.name}</span>
      {profile.skillLevel.description && <p>{profile.skillLevel.description}</p>}
    </div>
    {profile.ratings ? <dl className="profile-metrics"><Rating label="Kỹ năng" value={profile.ratings.skill} />
      <Rating label="Thái độ" value={profile.ratings.attitude} /></dl> : <p className="profile-unavailable">Đánh giá chưa khả dụng</p>}
    {profile.stats ? <dl className="profile-metrics"><div className="profile-metric"><dt>Trận hoàn tất</dt><dd>{profile.stats.matchesPlayed}</dd></div>
      <div className="profile-metric"><dt>Thắng</dt><dd>{profile.stats.wins}</dd></div>
      <div className="profile-metric"><dt>Thua</dt><dd>{profile.stats.losses}</dd></div></dl> : <p className="profile-unavailable">Thống kê chưa khả dụng</p>}
    {profile.stats && !profile.stats.resultsAvailable && <p>Chưa có kết quả giải đấu.</p>}
    <p className="profile-note">Thắng/thua chỉ tính các trận trong giải đấu có kết quả, gồm xử thắng WALKOVER; không tính BYE.</p>
  </section>;
}
