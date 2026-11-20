import { ArrowLeft, Phone, ShieldCheck } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { ContentPanel } from '@/components/common/content-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { playerContactApi } from './player-contact-api';
import { ApiError } from '../../../shared/api/http-client';
export function PlayerContactPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = () => {
    setLoading(true); setError('');
    playerContactApi.read().then(result => setPhone(result.data.phone ?? ''))
      .catch(() => setError('Không thể tải thông tin liên hệ.')).finally(() => setLoading(false));
  };
  useEffect(() => { let active = true; playerContactApi.read().then(result => { if (active) setPhone(result.data.phone ?? ''); }).catch(() => { if (active) setError('Không thể tải thông tin liên hệ.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  async function save(event: FormEvent) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(''); setSuccess('');
    try { const result = await playerContactApi.save(phone.trim() || null); setPhone(result.data.phone ?? ''); setSuccess('Đã lưu số điện thoại.'); }
    catch (error) { setError(error instanceof ApiError && error.code === 'VALIDATION_FAILED' ? 'Nhập 7–15 chữ số, có thể bắt đầu bằng +.' : 'Không thể lưu. Vui lòng thử lại.'); }
    finally { setSaving(false); }
  }
  return <PageContainer className="max-w-3xl">
    <PageHeader title="Thông tin liên hệ" actions={<Button asChild variant="outline"><Link to="/"><ArrowLeft aria-hidden="true" />Trang chủ</Link></Button>} />
    <ContentPanel title="Liên hệ khi đặt sân" icon={Phone}>
      <p className="flex items-start gap-3 rounded-lg bg-accent p-4 text-sm leading-6 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />Số điện thoại không bắt buộc. Chủ cơ sở có booking của bạn có thể xem để liên hệ; số này không hiển thị trên hồ sơ công khai.</p>
      {loading ? <p role="status" className="py-4 text-sm text-muted-foreground">Đang tải…</p> : <form onSubmit={save} className="flex flex-col gap-3">
        <Label htmlFor="player-phone">Số điện thoại (tùy chọn)</Label>
        <Input id="player-phone" type="tel" autoComplete="tel" maxLength={40} value={phone} onChange={event => setPhone(event.target.value)} />
        <p className="text-xs leading-5 text-muted-foreground">Để trống và lưu để xóa số đã cung cấp. Số điện thoại chưa được xác minh.</p>
        <Button variant="brand" className="mt-3 self-start" disabled={saving} type="submit">{saving ? 'Đang lưu…' : 'Lưu số điện thoại'}</Button>
      </form>}
      {error && <div role="alert" className="rounded-lg bg-danger-bg p-4 text-sm text-danger">{error} <Button variant="outline" type="button" className="mt-3" onClick={load}>Tải lại</Button></div>}
      {success && <p role="status" className="rounded-lg bg-success-bg p-4 text-sm text-success">{success}</p>}
    </ContentPanel>
  </PageContainer>;
}
