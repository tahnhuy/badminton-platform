import type { CSSProperties, ReactNode } from 'react';
import { Table, TableHead, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';

export interface ColumnDef<T> {
  key: string; header: ReactNode; width?: string | number; minWidth?: string | number;
  className?: string; headerClassName?: string; render: (item: T, index: number) => ReactNode;
}
export interface DataTableProps<T> {
  data: T[]; columns: ColumnDef<T>[]; keyExtractor: (item: T) => string | number;
  isLoading?: boolean; selectable?: boolean; selectedIds?: (string | number)[];
  onSelectAll?: (selected: boolean) => void; onSelectItem?: (id: string | number) => void;
  emptyState?: ReactNode; skeletonRows?: number; onRowClick?: (item: T) => void;
}
/** Column widths are runtime inputs owned by each caller; layout and presentation are shared. */
function columnStyle<T>(column: ColumnDef<T>): CSSProperties { return { width: column.width, minWidth: column.minWidth }; }
export function DataTable<T>({ data, columns, keyExtractor, isLoading = false, selectable = false, selectedIds = [], onSelectAll, onSelectItem, emptyState, skeletonRows = 6, onRowClick }: DataTableProps<T>) {
  const isAllSelected = data.length > 0 && data.every(item => selectedIds.includes(keyExtractor(item)));
  const isSomeSelected = data.some(item => selectedIds.includes(keyExtractor(item))) && !isAllSelected;
  return <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
    <p className="border-b border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground md:hidden">Cuộn ngang để xem đầy đủ các cột.</p>
    <div tabIndex={0} role="region" aria-label="Bảng dữ liệu" className="max-w-full overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      <Table>
        <thead>
          <tr>{selectable && <TableHead className="w-12 min-w-12 text-center">
            <input type="checkbox" className="size-4 accent-primary" aria-label="Chọn tất cả hàng" checked={isAllSelected} ref={el => { if (el) el.indeterminate = isSomeSelected; }} onChange={e => onSelectAll?.(e.target.checked)} />
          </TableHead>}{columns.map(col => <TableHead key={col.key} className={col.headerClassName || col.className} style={columnStyle(col)}>{col.header}</TableHead>)}</tr>
        </thead>
        <tbody>{isLoading ? Array.from({ length: skeletonRows }).map((_, index) => <tr key={`skeleton-${index}`}>{selectable && <TableCell className="text-center">
          <Skeleton className="mx-auto size-4 rounded-md" />
        </TableCell>}{columns.map(col => <TableCell key={`skeleton-col-${col.key}`} style={columnStyle(col)}>
          <Skeleton className="h-4 w-3/4 rounded-md" />
        </TableCell>)}</tr>) : data.length === 0 ? <tr>
          <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="py-12 text-center">{emptyState || <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <span className="text-sm font-semibold">Không tìm thấy dữ liệu phù hợp</span>
            <span className="text-sm">Vui lòng điều chỉnh hoặc xóa các bộ lọc để xem kết quả.</span>
          </div>}</TableCell>
        </tr> : data.map((item, index) => {
          const id = keyExtractor(item), isSelected = selectedIds.includes(id);
          return <tr key={id} className={cn('transition-colors hover:bg-muted/40', isSelected && 'bg-accent', onRowClick ? 'cursor-pointer' : 'cursor-default')} onClick={() => onRowClick?.(item)}>{selectable && <TableCell className="text-center" onClick={e => e.stopPropagation()}>
            <input type="checkbox" className="size-4 accent-primary" aria-label={`Chọn hàng ${id}`} checked={isSelected} onChange={() => onSelectItem?.(id)} />
          </TableCell>}{columns.map(col => <TableCell key={col.key} className={col.className} style={columnStyle(col)}>{col.render(item, index)}</TableCell>)}</tr>;
        })}</tbody>
      </Table>
    </div>
  </div>;
}
