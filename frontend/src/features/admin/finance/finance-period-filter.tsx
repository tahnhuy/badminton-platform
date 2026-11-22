import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function FinancePeriodFilter({ onApply }: { onApply: (period: { startDate: string; endDate: string }) => void }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  return <details className="col-span-full border-t border-border pt-3">
    <summary className="cursor-pointer rounded-md py-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Chọn khoảng ngày cụ thể</summary>
    <form aria-label="Khoảng ngày tài chính" className="mt-3 flex flex-col gap-3" onSubmit={event => {
      event.preventDefault();
      const days = (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1;
      if (!Number.isFinite(days) || days < 1 || days > 366) return setError('Chọn khoảng ngày hợp lệ, tối đa 366 ngày.');
      setError(''); onApply({ startDate, endDate });
    }}>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground">Từ ngày
          <Input type="date" required value={startDate} onChange={event => setStartDate(event.target.value)} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground">Đến ngày
          <Input type="date" required value={endDate} onChange={event => setEndDate(event.target.value)} />
        </label>
        <Button type="submit" variant="brand" className="self-end">Áp dụng khoảng ngày</Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  </details>;
}
