import React from 'react';

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
  const isAllSelected = data.length > 0 && data.every((item) => selectedIds.includes(keyExtractor(item)));
  const isSomeSelected = data.some((item) => selectedIds.includes(keyExtractor(item))) && !isAllSelected;

  return (
    <div className="admin-table-container">
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 48, minWidth: 48, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    className="table-checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={col.headerClassName || col.className}
                  style={{
                    width: col.width,
                    minWidth: col.minWidth,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: skeletonRows }).map((_, index) => (
                <tr key={`skeleton-${index}`}>
                  {selectable && (
                    <td style={{ textAlign: 'center' }}>
                      <div className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '4px', margin: '0 auto' }} />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={`skeleton-col-${col.key}`}
                      style={{
                        width: col.width,
                        minWidth: col.minWidth,
                      }}
                    >
                      <div className="skeleton" style={{ height: '18px', width: '75%', borderRadius: '4px' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} style={{ textAlign: 'center', padding: '64px 16px' }}>
                  {emptyState || (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#74777F' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>Không tìm thấy dữ liệu phù hợp</span>
                      <span style={{ fontSize: '13px' }}>Vui lòng điều chỉnh hoặc xóa các bộ lọc để xem kết quả.</span>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const id = keyExtractor(item);
                const isSelected = selectedIds.includes(id);

                return (
                  <tr
                    key={id}
                    className={isSelected ? 'row-selected' : ''}
                    onClick={() => onRowClick?.(item)}
                    style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  >
                    {selectable && (
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="table-checkbox"
                          checked={isSelected}
                          onChange={() => onSelectItem?.(id)}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={col.className}
                        style={{
                          width: col.width,
                          minWidth: col.minWidth,
                        }}
                      >
                        {col.render(item, index)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
