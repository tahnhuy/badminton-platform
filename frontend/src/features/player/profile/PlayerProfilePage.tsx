import { useOwnPlayerProfile } from './profile-context';
import { ProfileIdentity, ProfileSkill, ProfileRatings } from './ProfileSections';
import { ProfileNameForm } from './ProfileNameForm';
import { ProfileAsset } from './ProfileAssets';
import './profile.css';

export function PlayerProfilePage() {
  const state = useOwnPlayerProfile();
  const { profile, loading, error, retry, acceptUpdatedProfile, acceptAvatar, isPreview, saveName, uploadAvatar, avatarUploadEnabled } = state;
  return <div className="profile-page">
    <div className="profile-topbar"><nav aria-label="Đường dẫn" className="profile-breadcrumb">
      <a href="/"><ProfileAsset name="home" />Trang chủ</a><ProfileAsset name="chevron" /><span>Tài khoản của tôi</span>
      <ProfileAsset name="chevron" /><strong>Hồ sơ cá nhân</strong></nav>
      <span className="profile-sync"><i />{isPreview ? 'Bản xem thử giao diện' : 'Hồ sơ người chơi'}</span></div>
    <header className="profile-page-heading"><div><div className="profile-title-row"><h1>Hồ sơ cá nhân</h1><span className="profile-page-badge">PLAYER PROFILE</span></div>
      <p>Cập nhật thông tin hiển thị và theo dõi hành trình thi đấu của bạn cùng SmashPro.</p></div></header>
    {isPreview && <div className="profile-preview-note"><span>DỮ LIỆU MẪU</span><p>Bản xem thử hồ sơ. Bạn có thể thử đổi tên và ảnh; thay đổi chỉ áp dụng cho bản xem thử.</p></div>}
    {loading && <div className="profile-card profile-loading" role="status"><span />Đang tải hồ sơ…</div>}
    {error && <div className="profile-card profile-error" role="alert"><h2>Chưa thể tải hồ sơ</h2><p>{error}</p><button onClick={retry}>Thử lại</button></div>}
    {profile && <div className="profile-grid"><aside className="profile-left-column">
      <ProfileIdentity profile={profile} onUploaded={acceptAvatar} uploadAvatar={uploadAvatar} avatarUploadEnabled={avatarUploadEnabled} onReload={retry} /><ProfileSkill profile={profile} /></aside>
      <div className="profile-edit-column"><ProfileNameForm profile={profile} onSaved={acceptUpdatedProfile} onReload={retry} saveName={saveName} isPreview={isPreview} />
        <ProfileRatings profile={profile} /></div></div>}
  </div>;
}
