import { useState } from 'react';
import type { FormEvent } from 'react';
import { ProfileAsset } from './ProfileAssets';
import { profileApi, type PlayerProfile } from './profile-api';

interface ProfileNameFormProps {
  profile: PlayerProfile;
  onSaved: (profile: PlayerProfile) => void;
  onReload: () => void;
  saveName?: (fullName: string) => Promise<PlayerProfile>;
  isPreview?: boolean;
}
export function ProfileNameForm({ profile, onSaved, onReload, saveName = profileApi.updateName, isPreview }: ProfileNameFormProps) {
  const [name, setName] = useState(profile.fullName);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (name.trim().length < 2 || name.trim().length > 50) {
      setFeedback('Tên hiển thị cần có từ 2 đến 50 ký tự.'); setSaveError(true); return;
    }
    setSaving(true); setFeedback(null);
    try {
      const updated = await saveName(name);
      onSaved(updated); setName(updated.fullName);
      setSaveError(false); setFeedback('Đã lưu tên hiển thị.');
    } catch {
      // The server may have committed before a network failure; preserve input.
      setSaveError(true); setFeedback('Chưa xác nhận được việc lưu tên. Bạn có thể tải lại hồ sơ để kiểm tra hoặc thử lưu lại.');
    } finally { setSaving(false); }
  }
  return <section className="profile-name-section"><div className="profile-card profile-name-card"><div className="profile-section-heading">
      <span className="profile-icon-tile"><ProfileAsset name="identity" /></span><div><h2>Thông tin cơ bản</h2><p>Thông tin hiển thị trên hồ sơ người chơi</p></div><span className="profile-tag">HỒ SƠ CÔNG KHAI</span></div>
    <form id="profile-name-form" onSubmit={handleSave} noValidate><div className="profile-form-grid"><div><label htmlFor="profile-name">Tên hiển thị <span className="profile-required">*</span></label><div className="profile-input-wrap"><ProfileAsset name="user" />
      <input id="profile-name" value={name} disabled={saving} aria-describedby="profile-name-help"
        onChange={event => { setName(event.target.value); setFeedback(null); }} />
      </div><p id="profile-name-help" className="profile-note">Từ 2 đến 50 ký tự. Tên được hiển thị với những người chơi khác.</p></div><div><label>Trình độ hiện tại</label><div className="profile-readonly"><ProfileAsset name="lock" />{profile.skillLevel.name}<span>Chỉ xem</span></div><p className="profile-note">Được quản lý bởi nền tảng.</p></div></div>
    </form>
    <div className="profile-name-hint"><ProfileAsset name="shield" /><div><strong>Hồ sơ của bạn, cách bạn được nhận diện</strong><p>Chỉ tên hiển thị, ảnh đại diện, trình độ và thống kê thi đấu được chia sẻ trên hồ sơ.</p></div></div>
    </div><div className="profile-actions profile-save-bar"><span><ProfileAsset name="shield" />{isPreview ? 'Thay đổi chỉ lưu trong bản xem thử' : 'Tên được cập nhật trên hồ sơ của bạn'}</span><div>
      <button type="button" disabled={saving} onClick={() => { setName(profile.fullName); setFeedback(null); }}>Hủy</button>
      <button type="submit" form="profile-name-form" disabled={saving || name.trim() === profile.fullName}><ProfileAsset name="save" />{saving ? 'Đang lưu…' : 'Lưu tên'}</button></div></div>
    {feedback && <p role={saveError ? 'alert' : 'status'}>{feedback}</p>}
    {saveError && <button onClick={onReload}>Tải lại hồ sơ để kiểm tra</button>}
  </section>;
}
