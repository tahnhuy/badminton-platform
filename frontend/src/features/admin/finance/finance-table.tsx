import { DataTable, type DataTableProps } from '@/components/common/data-table';
import { cn } from '@/shared/utils/cn';

/** Keep financial amounts, dates and controls legible; long tables scroll in both directions. */
export function FinanceTable<T>({ columns, ...props }: Omit<DataTableProps<T>, 'scrollable'>) {
  return <DataTable {...props} scrollable columns={columns.map(column => ({
    ...column,
    minWidth: column.minWidth ?? (column.key === 'actions' || column.key === 'action' ? 160 : 120),
    headerClassName: cn('whitespace-nowrap', column.headerClassName),
    className: cn(!['desc', 'metadata', 'message', 'error'].includes(column.key) && 'whitespace-nowrap', column.className),
  }))} />;
}
