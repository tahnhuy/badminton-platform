import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '../../../components/common/Icons';

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

  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      padding: '16px 20px',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 16,
      border: '1px solid rgba(189, 202, 186, 0.3)'
    }}>
      {/* Left items per page selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
        <span>Hiển thị</span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          style={{
            height: 32,
            padding: '0 8px',
            backgroundColor: 'var(--bg-table-header)',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <span>trên tổng số <strong style={{ color: 'var(--text-primary)' }}>{total.toLocaleString('vi-VN')}</strong> {totalLabel}</span>
      </div>

      {/* Right page navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Prev */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: page <= 1 ? 'rgba(80, 95, 118, 0.4)' : 'var(--text-primary)',
            backgroundColor: 'var(--bg-table-header)'
          }}
        >
          <ChevronLeftIcon size={16} />
        </button>

        {/* Page buttons */}
        {getPageNumbers().map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} style={{ width: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
                …
              </span>
            );
          }
          const isCurrent = p === page;
          return (
            <button
              key={p}
              onClick={() => onPageChange(Number(p))}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isCurrent ? 'var(--color-brand)' : 'transparent',
                color: isCurrent ? '#FFFFFF' : 'var(--text-primary)',
                boxShadow: isCurrent ? 'var(--shadow-sm)' : 'none'
              }}
            >
              {p}
            </button>
          );
        })}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: page >= totalPages ? 'rgba(80, 95, 118, 0.4)' : 'var(--text-primary)',
            backgroundColor: 'var(--bg-table-header)'
          }}
        >
          <ChevronRightIcon size={16} />
        </button>
      </div>
    </div>
  );
};
