import React, { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface TablePaginationProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  totalLabel?: string;
  onPageChange: (newPage: number) => void;
  onLimitChange: (newLimit: number) => void;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  limit,
  total,
  totalPages,
  totalLabel = 'tài khoản',
  onPageChange,
  onLimitChange,
}) => {
  const limitId = useId();
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  return <div className="flex flex-col items-start justify-between gap-4 text-sm sm:flex-row sm:flex-wrap sm:items-center">
    <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
      <label htmlFor={limitId}>Hiển thị</label>
      <Select id={limitId} className="w-20" value={String(limit)} onChange={value => onLimitChange(Number(value))} options={[
        { value: '10', label: '10' },
        { value: '20', label: '20' },
        { value: '50', label: '50' },
      ]} />
      <span>trên tổng số <strong className="text-foreground">{total.toLocaleString('vi-VN')}</strong> {totalLabel}</span>
    </div>
    <nav aria-label="Phân trang bảng" className="flex max-w-full flex-wrap items-center gap-1">
      <Button size="icon" variant="outline" aria-label="Trang trước" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        <ChevronLeft aria-hidden="true" />
      </Button>{getPageNumbers().map((p, idx) => p === '...' ? <span key={`dots-${idx}`} className="px-1">…</span> : <Button key={p} size="icon" variant={p === page ? 'brand' : 'ghost'} aria-label={`Trang ${p}`} aria-current={p === page ? 'page' : undefined} onClick={() => onPageChange(Number(p))}>{p}</Button>)}<Button size="icon" variant="outline" aria-label="Trang sau" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  </div>;
};
