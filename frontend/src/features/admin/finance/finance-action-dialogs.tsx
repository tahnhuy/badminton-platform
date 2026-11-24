import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AdminDialog, AdminDialogFooter } from '../components/AdminDialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const amountSchema = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Nhập số tiền như 100000 hoặc 100000.50, không dùng dấu phân cách hàng nghìn.')
  .refine(value => Number(value) > 0, 'Số tiền phải lớn hơn 0.');
const reasonSchema = z.string().trim().min(1, 'Nhập lý do.').max(200);
const adjustmentSchema = z.object({ amount: amountSchema, reason: reasonSchema });
const matchSchema = adjustmentSchema.extend({
  provider: z.enum(['SEPAY', 'MOCK', 'VNPAY']),
  providerReference: z.string().trim().min(1, 'Nhập mã giao dịch ngân hàng.').max(120),
  userId: z.string().regex(/^[1-9]\d*$/, 'Nhập mã người dùng hợp lệ.'),
  topUpId: z.string().regex(/^$|^[1-9]\d*$/, 'Nhập mã lệnh nạp hợp lệ.'),
  transferTime: z.string().min(1, 'Nhập thời gian chuyển khoản.').refine(value => Number.isFinite(new Date(`${value}+07:00`).getTime()), 'Thời gian không hợp lệ.'),
});
export interface WalletAdjustmentPayload { amount: string; reason: string }
export interface ManualMatchPayload extends WalletAdjustmentPayload {
  provider: string; providerReference: string; userId: number; topUpId?: number; transferTime: string;
}
function message(error: unknown) { return error instanceof Error ? error.message : 'Không thể thực hiện thao tác.'; }
function FieldError({ message }: { message?: string }) { return message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null; }

export function WalletAdjustmentDialog({ open, kind, userId, onClose, onSubmit }: {
  open: boolean; kind: 'credit' | 'debit'; userId: string; onClose: () => void; onSubmit: (payload: WalletAdjustmentPayload) => Promise<void>;
}) {
  const [error, setError] = useState('');
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(adjustmentSchema), defaultValues: { amount: '', reason: '' } });
  useEffect(() => { if (open) { reset(); setError(''); } }, [open, reset]);
  const close = () => { if (!isSubmitting) onClose(); };
  const title = kind === 'credit' ? 'Cộng ví' : 'Trừ ví';
  return <AdminDialog open={open} onClose={close} allowEscape={!isSubmitting} title={`${title} người dùng #${userId}`} description="Số tiền VND, ví dụ 100000; không dùng dấu phân cách hàng nghìn.">
    <form className="space-y-4" noValidate onSubmit={handleSubmit(async values => { setError(''); try { await onSubmit(values); onClose(); } catch (err) { setError(message(err)); } })}>
      {error && <Alert variant="destructive">{error}</Alert>}
      <label className="flex flex-col gap-1 text-sm font-semibold">Số tiền (VND)<Input {...register('amount')} inputMode="decimal" placeholder="100000" disabled={isSubmitting} aria-invalid={Boolean(errors.amount)} /></label>
      <FieldError message={errors.amount?.message} />
      <label className="flex flex-col gap-1 text-sm font-semibold">Lý do<Input {...register('reason')} maxLength={200} disabled={isSubmitting} aria-invalid={Boolean(errors.reason)} /></label>
      <FieldError message={errors.reason?.message} />
      <AdminDialogFooter><Button type="button" variant="outline" onClick={close} disabled={isSubmitting}>Hủy</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang lưu...' : title}</Button></AdminDialogFooter>
    </form>
  </AdminDialog>;
}

export function ManualMatchDialog({ open, initialTopUp, onClose, onSubmit }: {
  open: boolean; initialTopUp?: { id: number; provider: string; userId: number; amount: string } | null; onClose: () => void; onSubmit: (payload: ManualMatchPayload) => Promise<void>;
}) {
  const [error, setError] = useState('');
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(matchSchema), defaultValues: { provider: 'SEPAY' as const, providerReference: '', amount: '', userId: '', reason: '', topUpId: '', transferTime: '' } });
  useEffect(() => { if (open) {
    reset({ provider: (initialTopUp?.provider ?? 'SEPAY') as 'SEPAY' | 'MOCK' | 'VNPAY', providerReference: '', amount: initialTopUp?.amount ?? '', userId: initialTopUp ? String(initialTopUp.userId) : '', reason: '', topUpId: initialTopUp ? String(initialTopUp.id) : '', transferTime: '' });
    setError('');
  } }, [open, initialTopUp, reset]);
  const close = () => { if (!isSubmitting) onClose(); };
  const fields = [
    ['topUpId', 'Mã lệnh nạp gốc (để trống chỉ khi không có lệnh)', 'text'],
    ['providerReference', 'Mã giao dịch ngân hàng', 'text'],
    ['amount', 'Số tiền (VND, ví dụ 100000)', 'text'],
    ['userId', 'Mã người dùng nhận tiền', 'text'],
    ['transferTime', 'Thời gian chuyển khoản (giờ Việt Nam)', 'datetime-local'],
    ['reason', 'Lý do ghép tay', 'text'],
  ] as const;
  return <AdminDialog open={open} onClose={close} allowEscape={!isSubmitting} title="Ghép giao dịch nạp tiền" description="Chọn lệnh nạp gốc để tránh cộng tiền hai lần khi webhook đến muộn. Chỉ để trống mã lệnh nếu giao dịch không có lệnh nạp.">
    <form className="space-y-4" noValidate onSubmit={handleSubmit(async values => {
      setError('');
      try { await onSubmit({ ...values, userId: Number(values.userId), topUpId: values.topUpId ? Number(values.topUpId) : undefined, transferTime: new Date(`${values.transferTime}+07:00`).toISOString() }); onClose(); }
      catch (err) { setError(message(err)); }
    })}>
      {error && <Alert variant="destructive">{error}</Alert>}
      <label className="flex flex-col gap-1 text-sm font-semibold">Nhà cung cấp<Controller control={control} name="provider" render={({ field }) => <Select ref={field.ref} name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} disabled={isSubmitting} options={['SEPAY', 'MOCK', 'VNPAY'].map(value => ({ value, label: value }))} />} /></label>
      {fields.map(([name, label, type]) => <div key={name}><label className="flex flex-col gap-1 text-sm font-semibold">{label}<Input {...register(name)} type={type} disabled={isSubmitting} aria-invalid={Boolean(errors[name])} /></label><FieldError message={errors[name]?.message} /></div>)}
      <AdminDialogFooter><Button type="button" variant="outline" onClick={close} disabled={isSubmitting}>Hủy</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang lưu...' : 'Ghép giao dịch'}</Button></AdminDialogFooter>
    </form>
  </AdminDialog>;
}
