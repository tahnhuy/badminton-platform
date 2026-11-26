import { useRef } from 'react';
import { CircleAlert, SearchX } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { Pagination } from '@/components/common/pagination';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { cn } from '@/shared/utils/cn';
import { MatchBookingContext } from '../components/MatchBookingContext';
import { CourtSearchFilters } from '../components/CourtSearchFilters';
import { FacilityResultCard } from '../components/FacilityResultCard';
import { useBookingMatchContext } from '../hooks/useBookingMatchContext';
import { useCourtSearch } from '../hooks/useCourtSearch';

function LoadingResults() {
  return <div className="grid gap-4 lg:grid-cols-2">
    {[0, 1].map(index => <div key={index} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" />
      <div className="flex flex-wrap gap-2 pt-2">{[0, 1, 2, 3].map(chip => <Skeleton key={chip} className="h-11 w-20 rounded-lg" />)}</div>
    </div>)}
  </div>;
}

export function CourtSearchPage() {
  const { forMatch } = useBookingMatchContext();
  const { state, results, hasWindow, apply, reset, goToPage } = useCourtSearch();
  const { data, isPending, isError, isFetching, isPlaceholderData, refetch } = results;
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const filtered = Boolean(state.name || state.city || state.district || hasWindow);

  const changePage = (page: number) => {
    goToPage(page);
    // Keep keyboard and screen-reader users at the top of the new results, not on the pager below.
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  const summary = isPending ? 'Đang tìm sân…'
    : isError ? 'Không tải được danh sách sân'
      : `Tìm thấy ${data.meta.total} cơ sở phù hợp · giá thấp đến cao${hasWindow ? ` · trống ${state.from}–${state.to}` : ''}`;

  return <PageContainer>
    <MatchBookingContext />
    <PageHeader title="Khám phá & Đặt sân cầu lông" description="Tìm theo khu vực, chọn ngày và khung giờ để xem sân còn trống." />

    <CourtSearchFilters applied={state} onApply={apply} onReset={reset} />

    <section aria-labelledby="court-results-heading" aria-busy={isFetching} className="flex scroll-mt-24 flex-col gap-4">
      <h2 id="court-results-heading" ref={headingRef} tabIndex={-1} className="flex items-center gap-2 text-sm font-medium text-muted-foreground outline-none">
        {summary}
        {isFetching && !isPending && <span className="text-xs font-normal">· Đang cập nhật…</span>}
      </h2>

      {isPending && <><span className="sr-only" role="status">Đang tải danh sách sân</span><LoadingResults /></>}

      {isError && <EmptyState role="alert" icon={CircleAlert} title="Không tải được danh sách sân"
        description="Vui lòng kiểm tra kết nối và thử lại." action={{ label: 'Thử lại', onClick: () => void refetch() }} />}

      {!isError && data && data.data.length === 0 && (data.meta.total > 0
        ? <EmptyState icon={SearchX} title="Trang này không có kết quả" description="Danh sách đã thay đổi hoặc số trang không còn tồn tại."
          action={{ label: 'Về trang đầu', onClick: () => changePage(1) }} />
        : <EmptyState icon={SearchX} title="Không tìm thấy sân phù hợp"
          description={filtered ? 'Thử đổi tên sân, khu vực, gõ một phần tên có dấu (ví dụ “Gò Vấp”) hoặc bỏ khung giờ.' : 'Hiện chưa có sân nào nhận đặt.'}
          action={filtered ? { label: 'Xóa bộ lọc', onClick: reset } : undefined} />)}

      {!isError && data && data.data.length > 0 && <div className={cn('grid gap-4 transition-opacity lg:grid-cols-2', isPlaceholderData && 'opacity-60')}>
        {data.data.map(item => <FacilityResultCard key={item.facility.id} item={item} date={state.date}
          window={hasWindow ? { from: state.from, to: state.to } : null} linkTo={forMatch} />)}
      </div>}

      {!isError && data && <Pagination page={state.page} totalPages={data.meta.totalPages} onPageChange={changePage} disabled={isPlaceholderData} />}
    </section>
  </PageContainer>;
}
