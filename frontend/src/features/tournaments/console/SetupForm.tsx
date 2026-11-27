import { MoneyPreview } from '@/components/common/money-preview';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, Check, DoorClosed, DoorOpen, LoaderCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ApiError } from '@/shared/api/http-client';
import { cn } from '@/shared/utils/cn';
import { FIELD_PROBLEM, feeLabel, fromLocalInput, toLocalInput } from '../format';
import { skillLevelOptionsQuery, useTournamentMutation } from '../queries';
import { tournamentApi } from '../tournament-api';
import type { Tournament, TournamentDetail, TournamentInput } from '../types';
import { Notice, Panel } from '../components/shared';

/** Setup form (TRN-08 "Thiết lập"): create or edit with the status-based locks of Tech Design §6.2. */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const schema = z.object({
  name: z.string().trim().min(3, 'Tên giải từ 3 ký tự').max(120, 'Tối đa 120 ký tự'),
  description: z.string().max(5000, 'Tối đa 5000 ký tự'),
  matchType: z.enum(['SINGLES', 'DOUBLES']),
  participantLimit: z.number({ error: 'Nhập số' }).int().min(2, 'Tối thiểu 2').max(128, 'Tối đa 128'),
  entryFee: z.number({ error: 'Nhập số' }).int().min(0, 'Không âm').max(10_000_000, 'Tối đa 10.000.000đ'),
  minSkillLevelId: z.string(),
  maxSkillLevelId: z.string(),
  venueNote: z.string().max(300, 'Tối đa 300 ký tự'),
  registrationStart: z.string().min(1, 'Bắt buộc'),
  registrationEnd: z.string().min(1, 'Bắt buộc'),
  tournamentStart: z.string().min(1, 'Bắt buộc'),
  tournamentEnd: z.string().min(1, 'Bắt buộc'),
  courtCount: z.number({ error: 'Nhập số' }).int().min(1, 'Tối thiểu 1').max(20, 'Tối đa 20'),
  matchDurationMinutes: z.number({ error: 'Nhập số' }).int().min(10, 'Tối thiểu 10').max(180, 'Tối đa 180'),
  minRestMinutes: z.number({ error: 'Nhập số' }).int().min(0, 'Không âm').max(240, 'Tối đa 240'),
  dailyStartTime: z.string().regex(HHMM, 'Giờ không hợp lệ'),
  dailyEndTime: z.string().regex(HHMM, 'Giờ không hợp lệ'),
});
type Values = z.infer<typeof schema>;
type Field = keyof Values;

const ALWAYS_EDITABLE_AFTER_CLOSE: Field[] = ['description', 'venueNote', 'courtCount', 'matchDurationMinutes', 'minRestMinutes', 'dailyStartTime', 'dailyEndTime'];

function lockReason(t: TournamentDetail | null, field: Field): string | null {
  if (!t || t.status === 'DRAFT') return null;
  if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return 'Giải đã kết thúc';
  if (t.status !== 'OPEN_FOR_REGISTRATION') return ALWAYS_EDITABLE_AFTER_CLOSE.includes(field) ? null : 'Đã đóng đăng ký';
  if (field === 'matchType') return 'Không đổi khi đang mở đăng ký';
  if (field === 'registrationStart' && new Date(t.registrationStart).getTime() <= Date.now()) return 'Đã bắt đầu nhận đăng ký';
  if ((field === 'entryFee' || field === 'minSkillLevelId' || field === 'maxSkillLevelId') && t.confirmedCount > 0) return 'Đã có người đăng ký';
  return null;
}

function defaults(t: Tournament | null): Values {
  const now = Date.now();
  const at = (days: number, hour: number) => { const d = new Date(now + days * 86_400_000); return `${toLocalInput(d.toISOString()).slice(0, 10)}T${String(hour).padStart(2, '0')}:00`; };
  if (!t) {
    return {
      name: '', description: '', matchType: 'SINGLES', participantLimit: 16, entryFee: 0, minSkillLevelId: '', maxSkillLevelId: '', venueNote: '',
      registrationStart: at(0, new Date().getHours() + 1 > 23 ? 23 : new Date().getHours() + 1), registrationEnd: at(7, 22), tournamentStart: at(9, 8), tournamentEnd: at(9, 21),
      courtCount: 2, matchDurationMinutes: 45, minRestMinutes: 15, dailyStartTime: '08:00', dailyEndTime: '21:00',
    };
  }
  return {
    name: t.name, description: t.description ?? '', matchType: t.matchType, participantLimit: t.participantLimit, entryFee: t.entryFee,
    minSkillLevelId: t.minSkillLevel ? String(t.minSkillLevel.id) : '', maxSkillLevelId: t.maxSkillLevel ? String(t.maxSkillLevel.id) : '',
    venueNote: t.venueNote ?? '', registrationStart: toLocalInput(t.registrationStart), registrationEnd: toLocalInput(t.registrationEnd),
    tournamentStart: toLocalInput(t.tournamentStart), tournamentEnd: toLocalInput(t.tournamentEnd),
    courtCount: t.schedule.courtCount, matchDurationMinutes: t.schedule.matchDurationMinutes, minRestMinutes: t.schedule.minRestMinutes,
    dailyStartTime: t.schedule.dailyStartTime, dailyEndTime: t.schedule.dailyEndTime,
  };
}

function toInput(v: Values): TournamentInput {
  return {
    name: v.name.trim(), description: v.description.trim() || null, matchType: v.matchType, participantLimit: v.participantLimit, entryFee: v.entryFee,
    minSkillLevelId: v.minSkillLevelId ? Number(v.minSkillLevelId) : null, maxSkillLevelId: v.maxSkillLevelId ? Number(v.maxSkillLevelId) : null,
    venueNote: v.venueNote.trim() || null,
    registrationStart: fromLocalInput(v.registrationStart), registrationEnd: fromLocalInput(v.registrationEnd),
    tournamentStart: fromLocalInput(v.tournamentStart), tournamentEnd: fromLocalInput(v.tournamentEnd),
    courtCount: v.courtCount, matchDurationMinutes: v.matchDurationMinutes, minRestMinutes: v.minRestMinutes,
    dailyStartTime: v.dailyStartTime, dailyEndTime: v.dailyEndTime,
  };
}

export function SetupForm({ tournament: t }: { tournament: TournamentDetail | null }) {
  const navigate = useNavigate();
  const levels = useQuery(skillLevelOptionsQuery);
  // Server values follow the tournament version only; unsaved edits survive background refetches.
  const serverValues = useMemo(() => (t ? defaults(t) : undefined), [t?.id, t?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [initialValues] = useState(() => defaults(t));
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initialValues, values: serverValues, resetOptions: { keepDirtyValues: true } });
  const entryFeePreview = useWatch({ control: form.control, name: 'entryFee' });
  const [confirm, setConfirm] = useState<null | 'open' | 'close' | 'cancel'>(null);
  const [cancelReason, setCancelReason] = useState('');
  const id = t?.id ?? null;

  const applyServerErrors = (error: unknown) => {
    if (!(error instanceof ApiError)) return;
    for (const detail of error.details) {
      const field = detail.field as Field | undefined;
      if (field && field in schema.shape) form.setError(field, { message: FIELD_PROBLEM[detail.code ?? ''] ?? 'Không hợp lệ' });
    }
  };
  const create = useTournamentMutation(null, (input: TournamentInput) => tournamentApi.create(input), 'Đã tạo bản nháp giải đấu.');
  const update = useTournamentMutation(id, (changes: Partial<TournamentInput>) => tournamentApi.update(t!.id, t!.version, changes), 'Đã lưu thay đổi.');
  const transition = useTournamentMutation(id, (action: 'open' | 'close') => tournamentApi.transition(t!.id, action, t!.version),
    r => (r.status === 'OPEN_FOR_REGISTRATION' ? 'Đã mở đăng ký.' : r.status === 'CANCELLED' ? 'Không đủ 2 người: giải đã tự huỷ và hoàn tiền.' : 'Đã đóng đăng ký.'));
  const cancel = useTournamentMutation(id, () => tournamentApi.cancel(t!.id, t!.version, cancelReason.trim() || undefined), 'Đã huỷ giải và hoàn lệ phí.');

  const submit = form.handleSubmit(values => {
    const input = toInput(values);
    if (!t) {
      create.mutate(input, { onSuccess: created => navigate(`/tournaments/${created.id}/manage`, { replace: true }), onError: applyServerErrors });
      return;
    }
    const dirty = Object.keys(form.formState.dirtyFields) as Field[];
    if (dirty.length === 0) return;
    const changes = Object.fromEntries(dirty.map(field => [field, input[field as keyof TournamentInput]])) as Partial<TournamentInput>;
    update.mutate(changes, { onSuccess: saved => form.reset(defaults(saved)), onError: applyServerErrors });
  });

  const busy = create.isPending || update.isPending;
  const levelOptions = [{ value: '', label: 'Không giới hạn' }, ...(levels.data ?? []).map(l => ({ value: String(l.id), label: l.name }))];
  const field = (name: Field, label: string, input: React.ReactNode, hint?: string, full = false) => {
    const lock = lockReason(t, name);
    const error = form.formState.errors[name]?.message;
    return <div className={cn('flex flex-col gap-1.5', full && 'sm:col-span-2')}>
      <Label htmlFor={`f-${name}`} className="flex items-center justify-between gap-2 font-semibold">
        {label}{lock && <span className="inline-flex items-center gap-1 text-2xs font-medium text-muted-foreground"><Lock aria-hidden="true" className="size-3" />{lock}</span>}
      </Label>
      {input}
      {name === 'entryFee' && <MoneyPreview value={entryFeePreview} />}
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>;
  };
  const num = (name: Field, props: React.ComponentProps<'input'> = {}) =>
    <Input id={`f-${name}`} type="number" inputMode="numeric" className="h-11" disabled={Boolean(lockReason(t, name))} aria-invalid={Boolean(form.formState.errors[name])}
      {...form.register(name, { valueAsNumber: true })} {...props} />;
  const text = (name: Field, props: React.ComponentProps<'input'> = {}) =>
    <Input id={`f-${name}`} className="h-11" disabled={Boolean(lockReason(t, name))} aria-invalid={Boolean(form.formState.errors[name])} {...form.register(name)} {...props} />;
  const selectField = (name: 'matchType' | 'minSkillLevelId' | 'maxSkillLevelId', options: Array<{ value: string; label: string }>) =>
    <Controller control={form.control} name={name} render={({ field: f }) =>
      <Select id={`f-${name}`} value={f.value} onChange={f.onChange} onBlur={f.onBlur} options={options} disabled={Boolean(lockReason(t, name))} />} />;

  const closedAfter = t && t.status !== 'DRAFT' && t.status !== 'OPEN_FOR_REGISTRATION';
  return <Panel title={t ? 'Thiết lập' : 'Thông tin giải'}>
    {closedAfter && t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && <Notice tone="info" icon={Lock} className="mb-4">Sau khi đóng đăng ký chỉ sửa được mô tả, địa điểm và cài đặt lịch.</Notice>}
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      {field('name', 'Tên giải', text('name', { placeholder: 'Ví dụ: Giải đơn mùa đông 2026' }), undefined, true)}
      {field('matchType', 'Nội dung', selectField('matchType', [{ value: 'SINGLES', label: 'Đơn' }, { value: 'DOUBLES', label: 'Đôi' }]))}
      {field('participantLimit', 'Số lượng tối đa', num('participantLimit', { min: 2, max: 128 }), t && t.confirmedCount > 0 ? `Không thấp hơn số đã đăng ký (${t.confirmedCount}).` : 'Đơn: số VĐV · Đôi: số đội. 2–128.')}
      {field('entryFee', 'Lệ phí (đồng)', num('entryFee', { min: 0, step: 10000 }), '0 = miễn phí.')}
      <div className="grid grid-cols-2 gap-3">
        {field('minSkillLevelId', 'Trình độ tối thiểu', selectField('minSkillLevelId', levelOptions))}
        {field('maxSkillLevelId', 'Tối đa', selectField('maxSkillLevelId', levelOptions))}
      </div>
      {field('registrationStart', 'Mở đăng ký', text('registrationStart', { type: 'datetime-local' }))}
      {field('registrationEnd', 'Hạn đăng ký', text('registrationEnd', { type: 'datetime-local' }), t?.status === 'OPEN_FOR_REGISTRATION' ? 'Đang mở: chỉ được gia hạn, không rút ngắn.' : undefined)}
      {field('tournamentStart', 'Bắt đầu thi đấu', text('tournamentStart', { type: 'datetime-local' }))}
      {field('tournamentEnd', 'Kết thúc', text('tournamentEnd', { type: 'datetime-local' }))}
      {field('venueNote', 'Địa điểm', text('venueNote', { placeholder: 'Tên nhà thi đấu, địa chỉ' }), 'Nhập tự do — không cần là sân trên hệ thống. Bắt buộc trước khi mở đăng ký.', true)}
      <fieldset className="grid gap-4 rounded-2xl border border-dashed border-brand-mint p-4 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1.5 text-sm font-bold text-brand-forest">Xếp lịch thi đấu</legend>
        <p className="-mt-1 text-sm text-muted-foreground sm:col-span-2">Dùng để hệ thống tự tính giờ và sân cho từng trận. Bạn vẫn sửa tay được lịch của trận chưa bắt đầu.</p>
        {field('courtCount', 'Số sân tại địa điểm', num('courtCount', { min: 1, max: 20 }), 'Số sân đánh song song. Trận được chia theo nhãn Sân 1, Sân 2… (đổi tên được), không đặt sân trên nền tảng.')}
        {field('matchDurationMinutes', 'Thời lượng dự kiến mỗi trận (phút)', num('matchDurationMinutes', { min: 10, max: 180 }), 'Chỉ để tính giờ bắt đầu các trận. Trận vẫn đánh 3 set, thắng 2 set — không giới hạn thời gian.')}
        {field('minRestMinutes', 'Nghỉ tối thiểu giữa hai trận (phút)', num('minRestMinutes', { min: 0, max: 240 }), 'Khoảng nghỉ ít nhất giữa hai trận liên tiếp của cùng một người chơi.')}
        <div className="grid grid-cols-2 gap-2">
          {field('dailyStartTime', 'Giờ bắt đầu mỗi ngày', text('dailyStartTime', { type: 'time' }))}
          {field('dailyEndTime', 'Giờ kết thúc mỗi ngày', text('dailyEndTime', { type: 'time' }))}
        </div>
      </fieldset>
      {field('description', 'Mô tả / thể lệ', <Textarea id="f-description" placeholder="Thể lệ, giải thưởng, lưu ý…" disabled={Boolean(lockReason(t, 'description'))} {...form.register('description')} />, undefined, true)}

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4 sm:col-span-2">
        {t?.status === 'DRAFT' && <Button type="button" variant="success-soft" className="h-11" onClick={() => setConfirm('open')}><DoorOpen aria-hidden="true" />Mở đăng ký</Button>}
        {t?.status === 'OPEN_FOR_REGISTRATION' && <Button type="button" variant="outline" className="h-11" onClick={() => setConfirm('close')}><DoorClosed aria-hidden="true" />Đóng đăng ký</Button>}
        {t && ['DRAFT', 'OPEN_FOR_REGISTRATION', 'REGISTRATION_CLOSED', 'READY'].includes(t.status) && <Button type="button" variant="danger-soft" className="h-11" onClick={() => setConfirm('cancel')}><Ban aria-hidden="true" />Huỷ giải</Button>}
        {(!t || !['COMPLETED', 'CANCELLED'].includes(t.status)) && <Button type="submit" variant="brand" className="h-11" disabled={busy || (Boolean(t) && !form.formState.isDirty)}>
          {busy ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : <Check aria-hidden="true" />}{t ? 'Lưu thay đổi' : 'Tạo bản nháp'}
        </Button>}
      </div>
    </form>

    {confirm === 'open' && <ConfirmDialog title="Mở đăng ký?" confirmLabel="Mở đăng ký" busyLabel="Đang mở…" busy={transition.isPending}
      description={<p>Giải xuất hiện công khai và người chơi đủ trình có thể đăng ký{t && t.entryFee > 0 ? `, trả ${feeLabel(t.entryFee)} bằng ví` : ''}.</p>}
      onCancel={() => setConfirm(null)} onConfirm={() => transition.mutate('open', { onSettled: () => setConfirm(null), onError: applyServerErrors })} />}
    {confirm === 'close' && <ConfirmDialog title="Đóng đăng ký?" confirmLabel="Đóng đăng ký" busyLabel="Đang đóng…" busy={transition.isPending}
      description={<><p>Người chơi không thể đăng ký hay rút nữa. Sau đó bạn xếp hạt giống và bốc thăm.</p>{t && t.confirmedCount < 2 && <p className="font-semibold text-danger">Hiện có dưới 2 người: giải sẽ tự huỷ và hoàn tiền.</p>}</>}
      onCancel={() => setConfirm(null)} onConfirm={() => transition.mutate('close', { onSettled: () => setConfirm(null) })} />}
    {confirm === 'cancel' && <ConfirmDialog title="Huỷ giải?" tone="danger" confirmLabel="Huỷ giải và hoàn tiền" busyLabel="Đang huỷ…" busy={cancel.isPending}
      description={<p>{t && t.confirmedCount > 0 ? <>{t.confirmedCount} đăng ký sẽ được <b>hoàn 100% lệ phí</b>. </> : null}Không thể hoàn tác.</p>}
      onCancel={() => setConfirm(null)} onConfirm={() => cancel.mutate(undefined, { onSettled: () => setConfirm(null) })}>
      <div className="mt-4 flex flex-col gap-1.5"><Label htmlFor="cancel-reason">Lý do (không bắt buộc)</Label>
        <Input id="cancel-reason" className="h-11" maxLength={300} value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Ví dụ: Nhà thi đấu đóng cửa" /></div>
    </ConfirmDialog>}
  </Panel>;
}
