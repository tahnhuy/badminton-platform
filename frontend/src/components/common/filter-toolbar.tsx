import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { ContentPanel } from './content-panel';
export interface FilterSelectConfig {
  id: string; value: string; placeholder?: string; options: { value: string; label: string }[];
  onChange: (value: string) => void; ariaLabel?: string;
}
export interface ActiveFilterChip { id: string; label: string; onRemove: () => void }
export interface FilterToolbarProps {
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  filters?: FilterSelectConfig[]; activeChips?: ActiveFilterChip[]; totalCount?: number;
  totalCountLabel?: string; onClearAll?: () => void; rightActions?: ReactNode;
}
export function FilterToolbar({ search, filters = [], activeChips = [], totalCount, totalCountLabel = 'kết quả phù hợp', onClearAll, rightActions }: FilterToolbarProps) {
  const hasActiveFilters = activeChips.length > 0 || Boolean(search?.value);
  return <ContentPanel>
    <div className="grid min-w-0 grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap">
      {search && <div className="relative min-w-0 xl:min-w-64 xl:flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-1 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="text" aria-label={search.placeholder || 'Tìm kiếm'} className="pl-10" value={search.value} onChange={e => search.onChange(e.target.value)} placeholder={search.placeholder || 'Tìm kiếm...'} />
      </div>}
      {filters.map(f => <Select
        key={f.id}
        className="xl:w-auto"
        value={f.value}
        onChange={f.onChange}
        aria-label={f.ariaLabel || f.placeholder}
        placeholder={f.placeholder}
        options={[...(f.placeholder ? [{ value: '', label: f.placeholder }] : []), ...f.options]}
      />)}{rightActions}
    </div>
    {hasActiveFilters && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="font-semibold text-muted-foreground">ĐANG LỌC:</span>
        {search?.value && <FilterChip label={`Tìm kiếm: "${search.value}"`} onRemove={() => search.onChange('')} />}
        {activeChips.map(chip => <FilterChip key={chip.id} {...chip} />)}
        {onClearAll && <Button variant="ghost" onClick={onClearAll}>Xóa tất cả</Button>}
      </div>{typeof totalCount === 'number' && <p className="text-muted-foreground">Tìm thấy <strong className="text-foreground">{totalCount}</strong> {totalCountLabel}</p>}
    </div>}
  </ContentPanel>;
}
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent pl-3 text-sm text-accent-foreground">
    <span className="min-w-0 break-words">{label}</span>
    <Button variant="ghost" size="icon" className="shrink-0 rounded-full" aria-label={`Bỏ lọc ${label}`} onClick={onRemove}>
      <X aria-hidden="true" />
    </Button>
  </span>;
}
