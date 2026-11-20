import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/** Previous/next pagination for server-paged lists; the caller owns the page state (e.g. URL). */
export function Pagination({ page, totalPages, onPageChange, disabled }: PaginationProps) {
  if (totalPages <= 1) return null;
  return <nav aria-label="Phân trang" className="flex items-center justify-center gap-3">
    <Button type="button" variant="outline" size="default" className="h-11" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
      <ChevronLeft aria-hidden="true" />Trước
    </Button>
    <p className="min-w-24 text-center text-sm text-muted-foreground">Trang <span className="font-semibold text-foreground">{page}</span> / {totalPages}</p>
    <Button type="button" variant="outline" size="default" className="h-11" disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}>
      Sau<ChevronRight aria-hidden="true" />
    </Button>
  </nav>;
}
