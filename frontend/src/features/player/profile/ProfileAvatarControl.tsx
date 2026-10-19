import { ApiError } from '../../../shared/api/http-client';
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { ProfileAsset } from './ProfileAssets';
import { profileApi } from './profile-api';

export function ProfileAvatarControl({ onUploaded, uploadAvatar = profileApi.uploadAvatar, onReload }: { onUploaded: (url: string) => void; uploadAvatar?: (file: File) => Promise<string>; onReload?: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || uploading) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024 || file.size === 0) {
      setFeedback('Chọn ảnh JPEG, PNG hoặc WebP có dung lượng tối đa 2 MB.'); setFailed(true); return;
    }
    setUploading(true); setFeedback(null);
    try {
      onUploaded(await uploadAvatar(file));
      setFailed(false); setFeedback('Đã cập nhật ảnh đại diện.');
    } catch (error) {
      setFailed(true); setFeedback(error instanceof ApiError && error.code === 'VALIDATION_FAILED'
        ? 'Ảnh không hợp lệ. Chọn JPEG, PNG hoặc WebP tối đa 2 MB.'
        : 'Chưa xác nhận được việc đổi ảnh. Tải lại hồ sơ để kiểm tra trước khi thử lại.');
    } finally { setUploading(false); }
  }
  return <div className="profile-avatar-control">
    <label className="profile-upload-button" htmlFor="profile-avatar-file"><ProfileAsset name="upload" />Đổi ảnh đại diện</label>
    <input id="profile-avatar-file" className="profile-file-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading}
      aria-describedby="profile-avatar-help" onChange={handleUpload} />
    <p id="profile-avatar-help" className="profile-note">JPEG/PNG/WebP · Tối đa 2 MB
Ảnh đại diện được lưu ngay.</p>
    {uploading && <p role="status">Đang tải ảnh lên…</p>}
    {feedback && <p role={failed ? 'alert' : 'status'}>{feedback}</p>}
    {failed && onReload && <button type="button" onClick={onReload}>Tải lại hồ sơ</button>}
  </div>;
}
