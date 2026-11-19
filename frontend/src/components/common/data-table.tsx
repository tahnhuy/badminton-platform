import { DataTable as CompatibleDataTable, type DataTableProps } from './DataTable';
export type { ColumnDef } from './DataTable';

/** Modern facade over the shared table. The legacy facade stays until its remaining consumers migrate. */
export function DataTable<T>(props: Omit<DataTableProps<T>, 'appearance'>) {
  return <CompatibleDataTable {...props} appearance="modern" />;
}
