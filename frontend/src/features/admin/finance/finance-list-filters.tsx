import { MoneyPreview } from '@/components/common/money-preview';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { financeLabel } from './finance-labels';

export type FinanceListFilters = Record<string, string>;
interface Field { key: string; label: string; type?: 'date' | 'number'; options?: string[] }
function fieldsFor(section: string): Field[] {
  const fields: Field[] = [{ key: 'from', label: 'Từ ngày', type: 'date' }, { key: 'to', label: 'Đến ngày', type: 'date' }];
  if (section === 'owner-earnings') fields.push({ key: 'ownerId', label: 'Mã chủ sân', type: 'number' });
  else if (section === 'audit') fields.push(
    { key: 'actorId', label: 'Mã người thực hiện', type: 'number' },
    { key: 'entityType', label: 'Loại đối tượng', options: ['WALLET', 'TOP_UP', 'PAYOUT', 'REFUND', 'BOOKING', 'EXPORT', 'RECONCILIATION'] },
    { key: 'entityId', label: 'Mã đối tượng' },
  );
  else fields.push({ key: 'userId', label: 'Mã người dùng', type: 'number' });
  if (section === 'transactions') fields.push(
    { key: 'minAmount', label: 'Số tiền từ (đ)', type: 'number' }, { key: 'maxAmount', label: 'Số tiền đến (đ)', type: 'number' },
    { key: 'referenceType', label: 'Loại tham chiếu', options: ['TOP_UP', 'BOOKING', 'PAYMENT', 'REFUND', 'WITHDRAWAL', 'OWNER_PAYOUT'] },
    { key: 'referenceId', label: 'Mã tham chiếu', type: 'number' },
  );
  if (section === 'top-ups') fields.push({ key: 'provider', label: 'Nhà cung cấp', options: ['SEPAY', 'VNPAY', 'MOCK'] });
  if (section === 'payouts') fields.push({ key: 'requestType', label: 'Loại yêu cầu', options: ['WITHDRAWAL', 'OWNER_PAYOUT'] });
  if (section === 'refunds') fields.push({ key: 'paymentId', label: 'Mã thanh toán', type: 'number' });
  return fields;
}
export function FinanceAdvancedFilters({ section, onApply, initialValues = {} }: { section: string; initialValues?: FinanceListFilters; onApply: (filters: FinanceListFilters) => void }) {
  const [draft, setDraft] = useState<FinanceListFilters>(initialValues);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(Object.values(initialValues).some(Boolean));
  const fields = fieldsFor(section);
  return <details className="col-span-full w-full border-t border-border pt-3">
    <summary className="cursor-pointer rounded-md py-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      Bộ lọc chi tiết{applied ? ' · Đang áp dụng' : ''}
    </summary>
    <form aria-label="Bộ lọc chi tiết tài chính" className="mt-3 flex flex-col gap-3" onSubmit={event => {
      event.preventDefault();
      if (draft.from && draft.to && draft.from > draft.to) return setError('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
      if (draft.minAmount && draft.maxAmount && Number(draft.minAmount) > Number(draft.maxAmount)) return setError('Số tiền đến phải lớn hơn hoặc bằng số tiền từ.');
      setError(''); setApplied(Object.values(draft).some(Boolean)); onApply(draft);
    }}>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {fields.map(field => <div key={field.key} className="flex min-w-0 flex-col gap-1"><label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <span>{field.label}</span>
          {field.options ? <Select value={draft[field.key] ?? ''} onChange={value => setDraft({ ...draft, [field.key]: value })} options={[{ value: '', label: 'Tất cả' }, ...field.options.map(value => ({ value, label: financeLabel(value) }))]} /> : <Input type={field.type ?? 'text'} value={draft[field.key] ?? ''}
            min={field.type === 'number' ? (field.key.endsWith('Amount') ? 0 : 1) : undefined}
            step={field.type === 'number' ? (field.key.endsWith('Amount') ? '0.01' : 1) : undefined}
            max={field.key.endsWith('Id') ? Number.MAX_SAFE_INTEGER : undefined}
            onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} />}
        </label>{field.key.endsWith('Amount') && <MoneyPreview value={draft[field.key]} />}</div>)}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" variant="brand">Áp dụng bộ lọc</Button>
        <Button type="button" variant="outline" onClick={() => { setDraft({}); setError(''); setApplied(false); onApply({}); }}>Xóa bộ lọc chi tiết</Button>
      </div>
    </form>
  </details>;
}
