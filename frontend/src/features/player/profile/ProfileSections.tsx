import type { PlayerProfile, RatingDimension } from './profile-api';
import { ProfileAsset } from './ProfileAssets';
import { ProfileAvatarControl } from './ProfileAvatarControl';

interface IdentityProps {
  profile: PlayerProfile;
  onUploaded: (url: string) => void;
  avatarUploadEnabled?: boolean;
  onReload?: () => void;
  uploadAvatar?: (file: File) => Promise<string>;
}
export function ProfileIdentity({ profile, onUploaded, uploadAvatar, avatarUploadEnabled, onReload }: IdentityProps) {
  return <section className="profile-card profile-identity-card" aria-label="Thông tin người chơi">
    <div className="profile-cover"><img src="/images/profile/cover.png" alt="" /><span /></div>
    <div className="profile-avatar-frame">{profile.avatarUrl
      ? <img className={`profile-avatar${profile.avatarUrl === '/images/profile/avatar.png' ? ' profile-figma-avatar' : ''}`} src={profile.avatarUrl} alt={`Ảnh đại diện ${profile.fullName}`} />
      : <div className="profile-avatar profile-initial" aria-label="Chưa có ảnh đại diện">{profile.fullName.slice(0, 1).toUpperCase()}</div>}</div>
    <h2>{profile.fullName}</h2><p className="profile-identity-caption">HỒ SƠ NGƯỜI CHƠI</p>
    <div className="profile-tier"><ProfileAsset name="trophy" /><span>Trình độ {profile.skillLevel.name}</span></div>
    {avatarUploadEnabled ? <ProfileAvatarControl onUploaded={onUploaded} uploadAvatar={uploadAvatar} onReload={onReload} />
      : <p className="profile-upload-unavailable">Đổi ảnh đại diện chưa khả dụng.</p>}
    {profile.stats ? <dl className="profile-summary-stats"><div><dt>Trận hoàn tất</dt><dd>{profile.stats.matchesPlayed}</dd></div>
      <div><dt>Thắng</dt><dd className="profile-green">{profile.stats.wins}</dd></div>
      <div><dt>Thua</dt><dd>{profile.stats.losses}</dd></div></dl> : <div className="profile-summary-unavailable">Thống kê chưa khả dụng</div>}
    <p className="profile-stat-caption">Thắng/thua chỉ tính kết quả giải đấu.</p>
  </section>;
}
export function ProfileSkill({ profile }: { profile: PlayerProfile }) {
  return <section className="profile-card profile-skill-card">
    <div className="profile-section-heading"><span className="profile-icon-tile olive"><ProfileAsset name="skill" /></span>
      <h2>Trình độ thi đấu</h2><span className="profile-lock"><ProfileAsset name="lock" />Chỉ xem</span></div>
    <div className="profile-level-panel"><div className="profile-level-number">{profile.skillLevel.rank}<span>/ 6</span></div>
      <div><p className="profile-eyebrow">TRÌNH ĐỘ HIỆN TẠI</p><h3>{profile.skillLevel.name}</h3></div></div>
    <div className="profile-level-steps" aria-label={`Trình độ ${profile.skillLevel.rank} trên 6 mức`}>
      {Array.from({ length: 6 }, (_, i) => <span key={i} className={i < profile.skillLevel.rank ? 'filled' : ''} />)}</div>
    {profile.skillLevel.description && <p className="profile-description">{profile.skillLevel.description}</p>}
    <div className="profile-info-note"><ProfileAsset name="shield" /><p>Trình độ được quản lý theo quy tắc của nền tảng và không thể tự chỉnh sửa.</p></div>
  </section>;
}
function RatingTile({ label, value, subtitle }: { label: string; value: RatingDimension; subtitle: string }) {
  const missing = value.notEnoughData || value.count < 3 || value.average === null;
  return <div className="profile-rating-tile"><div className="profile-rating-label"><span>{label}</span><span className="profile-star" aria-hidden="true">★</span></div>
    <div className="profile-rating-score">{missing ? <strong className="profile-rating-empty">Chưa đủ đánh giá</strong> : <><strong>{value.average!.toFixed(2)}</strong><span>/ 5.00</span></>}</div>
    <div className="profile-rating-track"><span style={{ width: missing ? '0%' : `${value.average! * 20}%` }} /></div>
    <p>{value.count} lượt đánh giá <span>· {subtitle}</span></p></div>;
}
export function ProfileRatings({ profile }: { profile: PlayerProfile }) {
  if (!profile.ratings) return <section className="profile-card profile-ratings-card">
    <div className="profile-section-heading"><span className="profile-icon-tile olive"><ProfileAsset name="trophy" /></span>
      <div><h2>Đánh giá từ người chơi</h2><p>Những đánh giá tổng hợp sau mỗi trận đấu</p></div></div>
    <div className="profile-unavailable"><h3>Đánh giá chưa khả dụng</h3><p>Đánh giá kỹ năng và thái độ sẽ xuất hiện khi tính năng này sẵn sàng.</p></div>
  </section>;
  return <section className="profile-card profile-ratings-card"><div className="profile-section-heading">
    <span className="profile-icon-tile olive"><ProfileAsset name="trophy" /></span><div><h2>Đánh giá từ người chơi</h2><p>Những đánh giá tổng hợp sau mỗi trận đấu</p></div><span className="profile-tag">TỔNG HỢP</span></div>
    <div className="profile-rating-grid"><RatingTile label="Kỹ năng thi đấu" value={profile.ratings.skill} subtitle="Kỹ năng" />
      <RatingTile label="Thái độ thi đấu" value={profile.ratings.attitude} subtitle="Thái độ" /></div>
    <p className="profile-description">Điểm trung bình được hiển thị khi có ít nhất 3 lượt đánh giá. Danh tính người đánh giá luôn được giữ riêng tư.</p>
    <div className="profile-results-note"><ProfileAsset name="shield" /><p>{profile.stats && !profile.stats.resultsAvailable && 'Chưa có kết quả giải đấu. '}
      Thắng/thua chỉ tính các trận trong giải đấu có kết quả, gồm WALKOVER; không tính BYE. Các trận giao lưu được tính vào tổng trận hoàn tất.</p></div>
  </section>;
}
