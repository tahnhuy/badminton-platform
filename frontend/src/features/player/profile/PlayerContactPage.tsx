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
  return <section style={{ width: 'min(640px, 100%)', padding: 24, margin: '24px auto' }}>
    <Link to="/">← Trang chủ</Link><h1>Thông tin liên hệ</h1>
    <p>Số điện thoại không bắt buộc. Chủ cơ sở có booking của bạn có thể xem để liên hệ; số này không hiển thị trên hồ sơ công khai.</p>
    {loading ? <p role="status">Đang tải…</p> : <form onSubmit={save}>
      <label htmlFor="player-phone">Số điện thoại (tùy chọn)</label>
      <input id="player-phone" type="tel" autoComplete="tel" maxLength={40} value={phone} onChange={event => setPhone(event.target.value)} style={{ display: 'block', padding: 12, width: '100%', margin: '12px 0' }} />
      <p>Để trống và lưu để xóa số đã cung cấp. Số điện thoại chưa được xác minh.</p>
      <button disabled={saving} type="submit">{saving ? 'Đang lưu…' : 'Lưu số điện thoại'}</button>
    </form>}
    {error && <div role="alert">{error} <button onClick={load}>Tải lại</button></div>}
    {success && <p role="status">{success}</p>}
  </section>;
}
