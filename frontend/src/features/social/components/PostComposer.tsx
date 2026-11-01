import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../../components/common/Dialog';
import { socialApi } from '../api';
import type { PostCard, PostPayload } from '../types';
import type { RecruitmentDraft, RecruitmentMatchType } from '../../matchmaking/types/recruitment';
import type { SkillLevel } from '../../matchmaking/types/matchmaking';
import { matchTypeLabels, socialError } from '../utils';
import { Notice } from './SocialUi';

export function PostComposer({ type, post, skills, onClose, onSaved }: { type: PostCard['type']; post?: PostCard; skills: SkillLevel[]; onClose: () => void; onSaved: (post: PostCard) => void }) {
  const [body, setBody] = useState(post?.body ?? ''); const [title, setTitle] = useState(post?.title ?? '');
  const [files, setFiles] = useState<File[]>([]); const [kept, setKept] = useState(post?.images ?? []);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const submitting = useRef(false);
  const [matchType, setMatchType] = useState<RecruitmentMatchType>('DOUBLES');
  const [date, setDate] = useState(''); const [time, setTime] = useState('');
  const [capacity, setCapacity] = useState(8); const [minimum, setMinimum] = useState(4); const [companions, setCompanions] = useState(0); const [duration, setDuration] = useState(90);
  const [minSkill, setMinSkill] = useState(String(skills[0]?.id ?? '')); const [maxSkill, setMaxSkill] = useState(String(skills.at(-1)?.id ?? ''));
  const [cost, setCost] = useState(''); const [hasCourt, setHasCourt] = useState(false);
  const [court, setCourt] = useState({ name: '', city: '', district: '', address: '' });
  const request = useRef<{ signature: string; files: File[]; key: string } | null>(null);
  useEffect(() => { const urls = files.map(file => URL.createObjectURL(file)); setPreviews(urls); return () => urls.forEach(url => URL.revokeObjectURL(url)); }, [files]);
  const addImages = (incoming: File[]) => {
    if (incoming.length + files.length + kept.length > 4) { setError('Mỗi bài viết có tối đa 4 ảnh.'); return; }
    if (incoming.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) { setError('Chọn ảnh JPEG, PNG hoặc WebP, mỗi ảnh tối đa 5MB.'); return; }
    setFiles(current => [...current, ...incoming]); setError('');
  };
  const save = async (publish: boolean) => {
    if (submitting.current) return;
    if (type === 'FREE' && !body.trim() && files.length + kept.length === 0) { setError('Nhập nội dung hoặc thêm ảnh trước khi đăng.'); return; }
    let recruitment: RecruitmentDraft | undefined;
    if (type === 'MATCH_FINDING' && !post) {
      if (!date || !time || !minSkill || !maxSkill) { setError('Vui lòng nhập ngày giờ và khoảng trình độ.'); return; }
      const min = skills.find(s => s.id === Number(minSkill)); const max = skills.find(s => s.id === Number(maxSkill));
      if (!min || !max || min.rank > max.rank) { setError('Khoảng trình độ không hợp lệ.'); return; }
      const start = new Date(`${date}T${time}:00+07:00`);
      if (!Number.isFinite(start.getTime())) { setError('Ngày giờ bắt đầu không hợp lệ (giờ Việt Nam).'); return; }
      recruitment = { matchType, startAt: start.toISOString(), minSkillLevelId: Number(minSkill), maxSkillLevelId: Number(maxSkill), costNote: cost.trim() || null,
        ...(matchType === 'GROUP' ? { durationMinutes: duration, capacity, minPlayers: minimum, companionCount: companions } : {}),
        ...(hasCourt ? { court: { ...court, kind: 'EXTERNAL' } } : {}),
      };
    }
    submitting.current = true; setBusy(true); setError('');
    try {
      let saved: PostCard;
      if (post) saved = await socialApi.edit(post.id, { body, ...(type === 'MATCH_FINDING' ? { title } : {}), keepImageIds: kept.map(image => image.id) }, files);
      else {
        const initial = { type, body, ...(type === 'MATCH_FINDING' ? { title, publish, recruitment } : {}) };
        const signature = JSON.stringify(initial);
        if (!request.current || request.current.signature !== signature || request.current.files.length !== files.length || files.some((file, i) => file !== request.current!.files[i])) request.current = { signature, files: [...files], key: crypto.randomUUID() };
        saved = await socialApi.create({ ...initial, clientRequestId: request.current.key } as PostPayload, files);
      }
      onSaved(saved);
    } catch (reason) { setError(socialError(reason)); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <Dialog title={post ? 'Chỉnh sửa bài viết' : type === 'FREE' ? 'Chia sẻ với cộng đồng' : 'Tạo bài tìm kèo'} busy={busy} onClose={onClose} wide={type === 'MATCH_FINDING'}>
    <form className="social-form" onSubmit={e => { e.preventDefault(); void save(true); }}>
      <fieldset disabled={busy}><div className={type === 'MATCH_FINDING' && !post ? 'social-composer-columns' : ''}><div className="social-stack">
        <section className="social-card"><h3>Thông tin bài đăng</h3>
          {type === 'MATCH_FINDING' && <label>Tiêu đề (không bắt buộc)<input maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="Đặt tên cho buổi chơi của bạn" /></label>}
          <label>{type === 'FREE' ? 'Nội dung chia sẻ' : 'Mô tả'}<textarea rows={5} maxLength={2000} value={body} onChange={e => setBody(e.target.value)} placeholder="Bạn muốn chia sẻ điều gì hôm nay?" /></label><small>{[...body].length}/2000 ký tự</small>
          <div className="social-image-previews">{kept.map(image => <div key={image.id}><img src={image.url} alt="Ảnh đã đăng" /><button type="button" aria-label="Bỏ ảnh đã đăng" onClick={() => setKept(current => current.filter(item => item.id !== image.id))}>×</button></div>)}{previews.map((url, index) => <div key={url}><img src={url} alt={files[index]?.name ?? 'Ảnh mới'} /><button type="button" aria-label={`Bỏ ảnh ${files[index]?.name}`} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}>×</button></div>)}</div>
          <label className="social-file-picker">Thêm ảnh<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { addImages(Array.from(e.target.files ?? [])); e.target.value = ''; }} /></label><small>Tối đa 4 ảnh JPEG/PNG/WebP, mỗi ảnh ≤ 5MB. Không đính kèm tài liệu.</small>
        </section>
        {type === 'MATCH_FINDING' && !post && <><section className="social-card"><h3>Loại kèo & sức chứa</h3><div className="social-actions" role="group" aria-label="Loại kèo">{(['SINGLES', 'DOUBLES', 'GROUP'] as const).map(value => <button className={`social-button${matchType === value ? ' social-primary' : ''}`} type="button" key={value} aria-pressed={matchType === value} onClick={() => setMatchType(value)}>{matchTypeLabels[value]}{value !== 'GROUP' ? ` · Tổng ${value === 'SINGLES' ? 2 : 4}` : ''}</button>)}</div>
          <div className="social-fields"><label>Ngày chơi<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label><label>Giờ bắt đầu<input type="time" required value={time} onChange={e => setTime(e.target.value)} /></label></div><small>Giờ Việt Nam · Tổng số chỗ bao gồm chủ kèo.</small>
          {matchType === 'GROUP' ? <><div className="social-fields"><label>Tổng số chỗ<input type="number" min={3} required value={capacity} onChange={e => setCapacity(Number(e.target.value))} /></label><label>Tối thiểu để chốt<input type="number" min={2} max={capacity} required value={minimum} onChange={e => setMinimum(Number(e.target.value))} /></label><label>Thời lượng (phút)<input type="number" min={60} max={180} required value={duration} onChange={e => setDuration(Number(e.target.value))} /></label></div><label>Người đi cùng không tài khoản<input type="number" min={0} max={capacity - 2} required value={companions} onChange={e => setCompanions(Number(e.target.value))} /></label><small>Người đi cùng được tính vào slot. Chốt kèo vẫn cần ít nhất một người chơi có tài khoản chấp nhận.</small></> : <small>Thời lượng được hệ thống xác định khi tạo kèo.</small>}
        </section><section className="social-card"><h3>Trình độ & địa điểm</h3><div className="social-fields">{[['Từ trình độ', minSkill, setMinSkill], ['Đến trình độ', maxSkill, setMaxSkill]].map(([label, value, setter]) => <label key={label as string}>{label as string}<select required value={value as string} onChange={e => (setter as (v: string) => void)(e.target.value)}><option value="">Chọn trình độ</option>{skills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label>)}</div>
          <label className="social-check"><input type="checkbox" checked={hasCourt} onChange={e => setHasCourt(e.target.checked)} />Khai báo sân chơi</label>
          {hasCourt && <>{(['name', 'city', 'district', 'address'] as const).map(key => <label key={key}>{{ name: 'Tên sân', city: 'Tỉnh / thành phố', district: 'Quận / huyện', address: 'Địa chỉ' }[key]}<input required maxLength={key === 'address' ? 500 : 100} value={court[key]} onChange={e => setCourt(current => ({ ...current, [key]: e.target.value }))} /></label>)}<small>Thông tin sân do chủ kèo cung cấp, chưa được xác minh.</small></>}
          <label>Ghi chú chi phí<input maxLength={200} value={cost} onChange={e => setCost(e.target.value)} placeholder="Thống nhất trực tiếp với người chơi" /></label>
        </section></>}
      </div>{type === 'MATCH_FINDING' && !post && <aside className="social-stack social-composer-preview"><section className="social-card"><h3>Xem trước bài tìm kèo</h3><span className="social-badge">{matchTypeLabels[matchType]}</span><h2>{title || 'Buổi chơi cùng cộng đồng'}</h2><p>{date || 'Chọn ngày'} · {time || 'Chọn giờ'} · Giờ Việt Nam</p><p>{hasCourt ? court.name || 'Chọn sân' : 'Chưa có sân'}</p><Notice>1{companions && matchType === 'GROUP' ? ` + ${companions} người đi cùng` : ''} / {matchType === 'GROUP' ? capacity : matchType === 'SINGLES' ? 2 : 4} chỗ</Notice><p className="social-body">{body}</p></section><Notice>Bạn chọn thời điểm công khai. Kèo chưa công khai vẫn có thể mời người chơi; lời mời không giữ chỗ.</Notice></aside>}</div></fieldset>
      {error && <Notice error>{error}</Notice>}{busy && <p role="status">Đang lưu bài viết…</p>}
      <div className="social-actions"><button className="social-button" type="button" disabled={busy} onClick={onClose}>Hủy</button>{!post && type === 'MATCH_FINDING' && <button className="social-button" type="submit" disabled={busy} onClick={e => { e.preventDefault(); if (e.currentTarget.form?.reportValidity()) void save(false); }}>Tạo kèo chưa công khai</button>}<button className="social-button social-primary" disabled={busy} type="submit">{busy ? 'Đang lưu…' : post ? 'Lưu thay đổi' : 'Đăng lên bảng tin'}</button></div>
    </form>
  </Dialog>;
}
