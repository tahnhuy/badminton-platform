import { useState } from 'react';
import type { FormEvent } from 'react';
import { LockKeyhole, Save, ShieldCheck, UserRound } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  return <section className="flex min-w-0 flex-col gap-4">
    <ContentPanel title="Thông tin cơ bản" icon={UserRound}>
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Thông tin hiển thị trên hồ sơ người chơi</p><Badge variant="success">HỒ SƠ CÔNG KHAI</Badge></div>
      <form id="profile-name-form" onSubmit={handleSave} noValidate className="grid gap-5 xl:grid-cols-2">
        <div className="flex flex-col gap-2"><Label htmlFor="profile-name">Tên hiển thị <span className="text-danger">*</span></Label>
          <Input id="profile-name" value={name} disabled={saving} aria-describedby="profile-name-help" onChange={event => { setName(event.target.value); setFeedback(null); }} />
          <p id="profile-name-help" className="text-xs leading-5 text-muted-foreground">Từ 2 đến 50 ký tự. Tên được hiển thị với những người chơi khác.</p>
        </div>
        <div className="flex flex-col gap-2"><p className="text-sm font-medium">Trình độ hiện tại</p><div className="flex min-h-13 items-center gap-2 rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground"><LockKeyhole aria-hidden="true" className="size-4 shrink-0" />{profile.skillLevel.name}<span className="ml-auto text-xs">Chỉ xem</span></div><p className="text-xs text-muted-foreground">Được quản lý bởi nền tảng.</p></div>
      </form>
      <div className="flex items-start gap-3 border-t border-border pt-5"><ShieldCheck aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" /><div><strong className="text-sm">Hồ sơ của bạn, cách bạn được nhận diện</strong><p className="mt-2 text-sm leading-6 text-muted-foreground">Chỉ tên hiển thị, ảnh đại diện, trình độ và thống kê thi đấu được chia sẻ trên hồ sơ.</p></div></div>
    </ContentPanel>
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />{isPreview ? 'Thay đổi chỉ lưu trong bản xem thử' : 'Tên được cập nhật trên hồ sơ của bạn'}</p>
      <div className="flex gap-3"><Button type="button" variant="outline" disabled={saving} onClick={() => { setName(profile.fullName); setFeedback(null); }}>Hủy</Button><Button type="submit" variant="brand" form="profile-name-form" disabled={saving || name.trim() === profile.fullName}><Save aria-hidden="true" />{saving ? 'Đang lưu…' : 'Lưu tên'}</Button></div>
    </div>
    {feedback && <p role={saveError ? 'alert' : 'status'} className={saveError ? 'rounded-lg bg-danger-bg p-4 text-sm text-danger' : 'rounded-lg bg-success-bg p-4 text-sm text-success'}>{feedback}</p>}
    {saveError && <Button variant="outline" className="h-auto min-h-12 whitespace-normal py-3" onClick={onReload}>Tải lại hồ sơ để kiểm tra</Button>}
  </section>;
}
