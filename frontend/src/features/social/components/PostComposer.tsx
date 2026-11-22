import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, Globe2, ImagePlus, Info, MapPin, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/shared/utils/cn';
import { useReturnFocus } from '@/shared/hooks/use-return-focus';
import { socialApi } from '../api';
import type { PostBackground, PostCard, PostPayload } from '../types';
import type { RecruitmentDraft, RecruitmentMatchType } from '../../matchmaking/types/recruitment';
import type { SkillLevel } from '../../matchmaking/types/matchmaking';
import { matchTypeLabels, socialError } from '../utils';
import { useOwnPlayerProfile } from '../../player/profile/profile-context';
import { postBackgrounds, backgroundClass } from './post-backgrounds';
import { Notice } from './SocialUi';

const control = 'h-11 rounded-lg bg-card px-3 text-sm motion-safe:focus-visible:translate-y-0';
const selectClass = 'h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none hover:border-ring/40 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/10';
const hint = 'text-xs leading-5 text-muted-foreground';

function Field({ id, label, children, className }: { id: string; label: string; children: ReactNode; className?: string }) {
  return <div className={cn('flex min-w-0 flex-col gap-1.5', className)}><Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</Label>{children}</div>;
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5"><h3 className="text-base font-bold tracking-tight">{title}</h3>{children}</section>;
}

export function PostComposer({ type, post, skills, onClose, onSaved, initialBackground = null }: { initialBackground?: PostBackground | null; type: PostCard['type']; post?: PostCard; skills: SkillLevel[]; onClose: () => void; onSaved: (post: PostCard) => void }) {
  const { profile } = useOwnPlayerProfile();
  const [background, setBackground] = useState<PostBackground | null>(post ? post.background ?? null : initialBackground);
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
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId(); const returnFocus = useReturnFocus();
  useEffect(() => { const urls = files.map(file => URL.createObjectURL(file)); setPreviews(urls); return () => urls.forEach(url => URL.revokeObjectURL(url)); }, [files]);
  const addImages = (incoming: File[]) => {
    if (incoming.length + files.length + kept.length > 4) { setError('Mỗi bài viết có tối đa 4 ảnh.'); return; }
    if (incoming.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) { setError('Chọn ảnh JPEG, PNG hoặc WebP, mỗi ảnh tối đa 5MB.'); return; }
    setBackground(null);
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
      if (post) saved = await socialApi.edit(post.id, { body, ...(type === 'FREE' ? { background } : {}), ...(type === 'MATCH_FINDING' ? { title } : {}), keepImageIds: kept.map(image => image.id) }, files);
      else {
        const initial = { type, body, ...(type === 'FREE' ? { background } : {}), ...(type === 'MATCH_FINDING' ? { title, publish, recruitment } : {}) };
        const signature = JSON.stringify(initial);
        if (!request.current || request.current.signature !== signature || request.current.files.length !== files.length || files.some((file, i) => file !== request.current!.files[i])) request.current = { signature, files: [...files], key: crypto.randomUUID() };
        saved = await socialApi.create({ ...initial, clientRequestId: request.current.key } as PostPayload, files);
      }
      onSaved(saved);
    } catch (reason) { setError(socialError(reason)); }
    finally { submitting.current = false; setBusy(false); }
  };
  const creatingMatch = type === 'MATCH_FINDING' && !post;
  const removeButton = 'absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-card text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent onOpenAutoFocus={event => { if (type === 'FREE') { event.preventDefault(); heading.current?.focus(); } }} closeDisabled={busy} className={cn('max-h-[92dvh] overflow-y-auto p-4 sm:p-6', creatingMatch ? 'max-w-270' : 'max-w-xl')} aria-describedby={undefined} onCloseAutoFocus={returnFocus}>
      <DialogTitle ref={heading} tabIndex={-1} className="mb-5 outline-none">{post ? 'Chỉnh sửa bài viết' : type === 'FREE' ? 'Tạo bài viết' : 'Tạo bài tìm kèo'}</DialogTitle>
      <form className="flex flex-col gap-5" onSubmit={e => { e.preventDefault(); void save(true); }}>
        <fieldset disabled={busy} className="min-w-0 disabled:opacity-75"><div className={cn(creatingMatch && 'grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]')}><div className="flex min-w-0 flex-col gap-4">
          <section className={cn('flex min-w-0 flex-col gap-4', type === 'MATCH_FINDING' && 'rounded-2xl border border-border p-4 sm:p-5')}>
            {type === 'FREE' && <div className="flex items-center gap-3 border-t border-border pt-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{profile?.fullName?.charAt(0) ?? 'B'}</span><div><p className="text-sm font-semibold">{profile?.fullName ?? 'Bạn'}</p><span className="mt-1 inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium"><Globe2 aria-hidden="true" className="size-3" />Công khai</span></div></div>}
            {type === 'MATCH_FINDING' && <Field id={`${id}-title`} label="Tiêu đề (không bắt buộc)"><Input id={`${id}-title`} className={control} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="Đặt tên cho buổi chơi của bạn" /></Field>}
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor={`${id}-body`} className="sr-only">{type === 'FREE' ? 'Nội dung chia sẻ' : 'Mô tả'}</Label>
              <div className={cn('flex min-w-0 items-center rounded-2xl', background && backgroundClass(background))}>
                <Textarea id={`${id}-body`} rows={background ? 3 : 5}
                  onPaste={event => { const images = Array.from(event.clipboardData.files).filter(file => file.type.startsWith('image/')); if (images.length) { event.preventDefault(); addImages(images); } }} maxLength={2000} value={body}
                  onChange={e => { setBody(e.target.value); if ([...e.target.value].length > 300) setBackground(null); }}
                  className={cn('resize-none border-0 bg-transparent p-3 text-lg shadow-none focus-visible:ring-0', background ? 'min-h-72 py-16 text-center text-2xl font-bold leading-relaxed text-white placeholder:text-white/75 sm:text-3xl' : 'min-h-40')}
                  placeholder="Bạn muốn chia sẻ điều gì hôm nay?" />
              </div>
              {type === 'FREE' && <><div role="group" aria-label="Chọn nền bài viết" className="flex flex-wrap items-center gap-2 p-1">
                <button type="button" aria-label="Không dùng nền" aria-pressed={!background} className={cn('flex size-10 items-center justify-center rounded-lg border-2 bg-card text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring', !background ? 'border-primary' : 'border-border')} onClick={() => setBackground(null)}>Aa</button>
                {postBackgrounds.map(item => <button key={item.id} type="button" aria-label={`Nền ${item.label}`} aria-pressed={background === item.id}
                  disabled={files.length + kept.length > 0 || [...body].length > 300}
                  className={cn('flex size-10 items-center justify-center rounded-lg border-2 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-35', item.className, background === item.id ? 'border-foreground ring-2 ring-ring' : 'border-transparent')}
                  onClick={() => setBackground(item.id)}>{background === item.id ? <Check aria-hidden="true" className="size-5" /> : <span className="text-sm font-bold">Aa</span>}</button>)}
              </div><small className={hint}>{files.length + kept.length ? 'Bài có ảnh dùng nền thường.' : 'Nền mẫu dành cho bài chữ tối đa 300 ký tự.'}</small></>}
              <small className={cn(hint, 'self-end')}>{[...body].length}/{background ? 300 : 2000} ký tự</small>
            </div>
            {(!!kept.length || !!previews.length) && <div className="flex flex-wrap gap-2">
              {kept.map(image => <div key={image.id} className="relative size-25"><img className="size-full rounded-lg object-cover" src={image.url} alt="Ảnh đã đăng" /><button type="button" className={removeButton} aria-label="Bỏ ảnh đã đăng" onClick={() => setKept(current => current.filter(item => item.id !== image.id))}><X aria-hidden="true" className="size-4" /></button></div>)}
              {previews.map((url, index) => <div key={url} className="relative size-25"><img className="size-full rounded-lg object-cover" src={url} alt={files[index]?.name ?? 'Ảnh mới'} /><button type="button" className={removeButton} aria-label={`Bỏ ảnh ${files[index]?.name}`} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><X aria-hidden="true" className="size-4" /></button></div>)}
            </div>}
            <div className="flex flex-col items-start gap-1.5">
              <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"><ImagePlus aria-hidden="true" className="size-4 text-primary" />Thêm ảnh
                <input type="file" className="absolute inset-0 cursor-pointer opacity-0" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { addImages(Array.from(e.target.files ?? [])); e.target.value = ''; }} /></label>
              <small className={hint}>Tối đa 4 ảnh JPEG/PNG/WebP, mỗi ảnh ≤ 5MB. Không đính kèm tài liệu.</small>
            </div>
          </section>
          {creatingMatch && <><Panel title="Loại kèo & sức chứa">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Loại kèo">{(['SINGLES', 'DOUBLES', 'GROUP'] as const).map(value => <Button type="button" key={value} variant={matchType === value ? 'default' : 'outline'} className="h-11" aria-pressed={matchType === value} onClick={() => setMatchType(value)}>{matchTypeLabels[value]}{value !== 'GROUP' ? ` · Tổng ${value === 'SINGLES' ? 2 : 4}` : ''}</Button>)}</div>
            <div className="grid grid-cols-2 gap-3"><Field id={`${id}-date`} label="Ngày chơi"><Input id={`${id}-date`} className={control} type="date" required value={date} onChange={e => setDate(e.target.value)} /></Field><Field id={`${id}-time`} label="Giờ bắt đầu"><Input id={`${id}-time`} className={control} type="time" required value={time} onChange={e => setTime(e.target.value)} /></Field></div>
            <small className={hint}>Giờ Việt Nam · Tổng số chỗ bao gồm chủ kèo.</small>
            {matchType === 'GROUP' ? <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Field id={`${id}-capacity`} label="Tổng số chỗ"><Input id={`${id}-capacity`} className={control} type="number" min={3} required value={capacity} onChange={e => setCapacity(Number(e.target.value))} /></Field><Field id={`${id}-minimum`} label="Tối thiểu để chốt"><Input id={`${id}-minimum`} className={control} type="number" min={2} max={capacity} required value={minimum} onChange={e => setMinimum(Number(e.target.value))} /></Field><Field id={`${id}-duration`} label="Thời lượng (phút)"><Input id={`${id}-duration`} className={control} type="number" min={60} max={180} required value={duration} onChange={e => setDuration(Number(e.target.value))} /></Field></div>
              <Field id={`${id}-companions`} label="Người đi cùng không tài khoản"><Input id={`${id}-companions`} className={control} type="number" min={0} max={capacity - 2} required value={companions} onChange={e => setCompanions(Number(e.target.value))} /></Field>
              <small className={hint}>Người đi cùng được tính vào slot. Chốt kèo vẫn cần ít nhất một người chơi có tài khoản chấp nhận.</small>
            </> : <small className={hint}>Thời lượng được hệ thống xác định khi tạo kèo.</small>}
          </Panel>
          <Panel title="Trình độ & địa điểm">
            <div className="grid grid-cols-2 gap-3">{([['min', 'Từ trình độ', minSkill, setMinSkill], ['max', 'Đến trình độ', maxSkill, setMaxSkill]] as const).map(([key, label, value, setter]) => <Field key={key} id={`${id}-${key}-skill`} label={label}><select id={`${id}-${key}-skill`} className={selectClass} required value={value} onChange={e => setter(e.target.value)}><option value="">Chọn trình độ</option>{skills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></Field>)}</div>
            <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4.5 shrink-0 accent-primary" checked={hasCourt} onChange={e => setHasCourt(e.target.checked)} />Khai báo sân chơi</label>
            {hasCourt && <><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{(['name', 'city', 'district', 'address'] as const).map(key => <Field key={key} id={`${id}-court-${key}`} label={{ name: 'Tên sân', city: 'Tỉnh / thành phố', district: 'Quận / huyện', address: 'Địa chỉ' }[key]}><Input id={`${id}-court-${key}`} className={control} required maxLength={key === 'address' ? 500 : 100} value={court[key]} onChange={e => setCourt(current => ({ ...current, [key]: e.target.value }))} /></Field>)}</div><small className={hint}>Thông tin sân do chủ kèo cung cấp, chưa được xác minh.</small></>}
            <Field id={`${id}-cost`} label="Ghi chú chi phí"><Input id={`${id}-cost`} className={control} maxLength={200} value={cost} onChange={e => setCost(e.target.value)} placeholder="Thống nhất trực tiếp với người chơi" /></Field>
          </Panel></>}
        </div>{creatingMatch && <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-0">
          <section className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-accent/60 p-4 sm:p-5"><h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Xem trước bài tìm kèo</h3><Badge variant="success" className="self-start">{matchTypeLabels[matchType]}</Badge><h2 className="text-lg font-bold tracking-tight wrap-anywhere">{title || 'Buổi chơi cùng cộng đồng'}</h2>
            <p className="text-sm">{date || 'Chọn ngày'} · {time || 'Chọn giờ'} · Giờ Việt Nam</p><p className="flex items-center gap-2 text-sm"><MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" />{hasCourt ? court.name || 'Chọn sân' : 'Chưa có sân'}</p>
            <Notice><span className="flex items-center gap-2"><Users aria-hidden="true" className="size-4 shrink-0 text-primary" />1{companions && matchType === 'GROUP' ? ` + ${companions} người đi cùng` : ''} / {matchType === 'GROUP' ? capacity : matchType === 'SINGLES' ? 2 : 4} chỗ</span></Notice><p className="whitespace-pre-wrap text-sm wrap-anywhere">{body}</p></section>
          <Notice><span className="flex gap-2"><Info aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />Bạn chọn thời điểm công khai. Kèo chưa công khai vẫn có thể mời người chơi; lời mời không giữ chỗ.</span></Notice>
        </aside>}</div></fieldset>
        {error && <Notice error>{error}</Notice>}{busy && <p role="status" className="text-sm text-muted-foreground">Đang lưu bài viết…</p>}
        <div className={cn(type === 'FREE' && '[&>button:last-child]:flex-1', 'flex flex-wrap justify-end gap-2 border-t border-border pt-4')}><Button variant="ghost" className="h-11" type="button" disabled={busy} onClick={onClose}>Hủy</Button>{creatingMatch && <Button variant="outline" className="h-11" type="submit" disabled={busy} onClick={e => { e.preventDefault(); if (e.currentTarget.form?.reportValidity()) void save(false); }}>Tạo kèo chưa công khai</Button>}<Button className="h-11" disabled={busy || (type === 'FREE' && !body.trim() && files.length + kept.length === 0)} type="submit">{busy ? 'Đang lưu…' : post ? 'Lưu thay đổi' : type === 'FREE' ? 'Đăng' : 'Đăng lên bảng tin'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
