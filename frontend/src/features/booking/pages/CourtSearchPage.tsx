import { useBookingMatchContext } from '../hooks/useBookingMatchContext';
import { MatchBookingContext } from '../components/MatchBookingContext';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { ApiError } from '../../../shared/api/http-client';
import { CourtSearchFilters, type CourtSearchFilterValue } from '../components/CourtSearchFilters';
import { CourtCard } from '../components/CourtCard';
import { LoadingCards, StateBlock } from '../components/StateBlocks';
import { ChevronLeftIcon, ChevronRightIcon } from '../../../components/common/Icons';
import { todayIso } from '../utils/booking';
import type { CourtSearchParams, CourtSummary, PageMeta } from '../types/booking';

type SearchStatus = 'loading' | 'success' | 'error';

const EMPTY_FILTERS: CourtSearchFilterValue = {
  city: '',
  district: '',
  date: todayIso(),
  startTime: '',
  endTime: '',
};

function toParams(filters: CourtSearchFilterValue, page: number): CourtSearchParams {
  const hasWindow = Boolean(filters.date && filters.startTime && filters.endTime);
  return {
    city: filters.city.trim() || undefined,
    district: filters.district.trim() || undefined,
    date: filters.date || undefined,
    startTime: hasWindow ? filters.startTime : undefined,
    endTime: hasWindow ? filters.endTime : undefined,
    page,
    limit: 9,
  };
}

export function CourtSearchPage() {
  const { forMatch } = useBookingMatchContext();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<CourtSearchFilterValue>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<CourtSearchParams>(() => toParams(EMPTY_FILTERS, 1));
  const [courts, setCourts] = useState<CourtSummary[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [status, setStatus] = useState<SearchStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (params: CourtSearchParams) => {
    setStatus('loading');
    setError(null);
    try {
      const response = await bookingService.searchCourts(params);
      setCourts(response.data);
      setMeta(response.meta);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Không thể tải danh sách sân. Vui lòng thử lại.');
    }
  }, []);

  useEffect(() => {
    void load(applied);
  }, [applied, load]);

  const handleSubmit = () => {
    const provided = [filters.date, filters.startTime, filters.endTime].filter(Boolean).length;
    if (provided > 0 && provided < 3) {
      setFormError('Vui lòng chọn đủ ngày, giờ bắt đầu và giờ kết thúc.');
      return;
    }
    if (filters.startTime && filters.endTime && filters.startTime >= filters.endTime) {
      setFormError('Giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }
    setFormError(null);
    setApplied(toParams(filters, 1));
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setFormError(null);
    setApplied(toParams(EMPTY_FILTERS, 1));
  };

  const handleView = (courtId: number) => {
    const query = applied.date ? `?date=${applied.date}` : '';
    navigate(forMatch(`/courts/${courtId}${query}`));
  };

  const goToPage = (page: number) => {
    if (!meta) return;
    if (page < 1 || page > meta.totalPages) return;
    setApplied((prev) => ({ ...prev, page }));
  };

  return (
    <div style={{ width: '100%', maxWidth: 1440, margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <MatchBookingContext />
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 28, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
          Khám phá & Đặt sân cầu lông
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Kiểm tra lịch trống theo thời gian thực và chọn khung giờ phù hợp.
        </p>
      </header>

      <CourtSearchFilters
        value={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onSubmit={handleSubmit}
        onReset={handleReset}
      />
      {formError && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--color-danger)' }}>
          {formError}
        </span>
      )}

      {status === 'success' && meta && (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Tìm thấy {meta.total} sân phù hợp
        </span>
      )}

      {status === 'loading' && <LoadingCards />}
      {status === 'error' && error && (
        <StateBlock title="Không tải được dữ liệu" description={error} actionLabel="Thử lại" onAction={() => void load(applied)} />
      )}
      {status === 'success' && courts.length === 0 && (
        <StateBlock
          title="Không tìm thấy sân phù hợp"
          description="Hãy thử đổi khu vực hoặc khung giờ tìm kiếm."
          actionLabel="Xóa bộ lọc"
          onAction={handleReset}
        />
      )}
      {status === 'success' && courts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {courts.map((court) => (
            <CourtCard key={court.id} court={court} onView={handleView} />
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => goToPage(meta.page - 1)}
            disabled={meta.page <= 1}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', fontWeight: 600, fontSize: 13 }}
          >
            <ChevronLeftIcon size={14} />
            Trước
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Trang {meta.page} / {meta.totalPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(meta.page + 1)}
            disabled={meta.page >= meta.totalPages}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', fontWeight: 600, fontSize: 13 }}
          >
            Sau
            <ChevronRightIcon size={14} />
          </button>
        </nav>
      )}
    </div>
  );
}
