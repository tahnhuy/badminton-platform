import React from 'react';
import { Table, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/shared/utils/cn';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  width?: string | number;
  minWidth?: string | number;
  className?: string;
  headerClassName?: string;
  render: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  /** Legacy is retained only for Owner/Admin consumers awaiting their batch. */
  appearance?: 'legacy' | 'modern';
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  selectable?: boolean;
  selectedIds?: (string | number)[];
  onSelectAll?: (selected: boolean) => void;
  onSelectItem?: (id: string | number) => void;
  emptyState?: React.ReactNode;
  skeletonRows?: number;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  appearance = 'legacy',
  data,
  columns,
  keyExtractor,
  isLoading = false,
  selectable = false,
  selectedIds = [],
  onSelectAll,
  onSelectItem,
  emptyState,
  skeletonRows = 6,
  onRowClick,
}: DataTableProps<T>): React.ReactElement {
  const modern = appearance === 'modern';
  const TableElement = modern ? Table : 'table';
  const Head = modern ? TableHead : 'th';
  const Cell = modern ? TableCell : 'td';
  const isAllSelected = data.length > 0 && data.every((item) => selectedIds.includes(keyExtractor(item)));
  const isSomeSelected = data.some((item) => selectedIds.includes(keyExtractor(item))) && !isAllSelected;

  return (
    <div className={modern ? "min-w-0 overflow-hidden rounded-2xl border border-border bg-card" : "admin-table-container"}>
      <div tabIndex={modern ? 0 : undefined} role={modern ? "region" : undefined} aria-label={modern ? "Bảng dữ liệu" : undefined} className={modern ? "max-w-full overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" : "admin-table-scroll"}>
        <TableElement className={modern ? undefined : "admin-table"}>
          <thead>
            <tr>
              {selectable && (
                <Head className={modern ? 'w-12 min-w-12 text-center' : undefined} style={modern ? undefined : { width: 48, minWidth: 48, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    className={modern ? "size-4 accent-primary" : "table-checkbox"}
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                  />
                </Head>
              )}
              {columns.map((col) => (
                <Head
                  key={col.key}
                  className={col.headerClassName || col.className}
                  style={{
                    width: col.width,
                    minWidth: col.minWidth,
                  }}
                >
                  {col.header}
                </Head>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: skeletonRows }).map((_, index) => (
                <tr key={`skeleton-${index}`}>
                  {selectable && (
                    <Cell className={modern ? 'text-center' : undefined} style={modern ? undefined : { textAlign: 'center' }}>
                      <div className={modern ? 'mx-auto size-4 animate-pulse rounded-md bg-muted motion-reduce:animate-none' : 'skeleton'} style={modern ? undefined : { width: '16px', height: '16px', borderRadius: '4px', margin: '0 auto' }} />
                    </Cell>
                  )}
                  {columns.map((col) => (
                    <Cell
                      key={`skeleton-col-${col.key}`}
                      style={{
                        width: col.width,
                        minWidth: col.minWidth,
                      }}
                    >
                      <div className={modern ? 'h-4 w-3/4 animate-pulse rounded-md bg-muted motion-reduce:animate-none' : 'skeleton'} style={modern ? undefined : { height: '18px', width: '75%', borderRadius: '4px' }} />
                    </Cell>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <Cell colSpan={columns.length + (selectable ? 1 : 0)} className={modern ? 'py-12 text-center' : undefined} style={modern ? undefined : { textAlign: 'center', padding: '64px 16px' }}>
                  {emptyState || (
                    <div className={modern ? 'flex flex-col items-center gap-2 text-muted-foreground' : undefined} style={modern ? undefined : { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#74777F' }}>
                      <span className={modern ? 'text-sm font-semibold' : undefined} style={modern ? undefined : { fontSize: '14px', fontWeight: 600 }}>Không tìm thấy dữ liệu phù hợp</span>
                      <span className={modern ? 'text-sm' : undefined} style={modern ? undefined : { fontSize: '13px' }}>Vui lòng điều chỉnh hoặc xóa các bộ lọc để xem kết quả.</span>
                    </div>
                  )}
                </Cell>
              </tr>
            ) : (
              data.map((item, index) => {
                const id = keyExtractor(item);
                const isSelected = selectedIds.includes(id);

                return (
                  <tr
                    key={id}
                    className={modern ? cn('transition-colors hover:bg-muted/40', isSelected && 'bg-accent') : isSelected ? 'row-selected' : ''}
                    onClick={() => onRowClick?.(item)}
                    style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  >
                    {selectable && (
                      <Cell style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className={modern ? "size-4 accent-primary" : "table-checkbox"}
                          checked={isSelected}
                          onChange={() => onSelectItem?.(id)}
                        />
                      </Cell>
                    )}
                    {columns.map((col) => (
                      <Cell
                        key={col.key}
                        className={col.className}
                        style={{
                          width: col.width,
                          minWidth: col.minWidth,
                        }}
                      >
                        {col.render(item, index)}
                      </Cell>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </TableElement>
      </div>
    </div>
  );
}
