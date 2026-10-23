import { useBookingMatchContext } from '../hooks/useBookingMatchContext';
import { MatchBookingContext } from '../components/MatchBookingContext';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { ApiError } from '../../../shared/api/http-client';
import { StateBlock } from '../components/StateBlocks';
import { ArrowLeftIcon, CourtIcon, ChevronRightIcon } from '../../../components/common/Icons';
import { formatCurrency, formatTimeRange, todayIso } from '../utils/booking';
import type { FacilityDetail } from '../types/booking';

export function FacilityDetailPage() {
  const { forMatch } = useBookingMatchContext();
  const { facilityId: facilityIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const facilityId = Number(facilityIdParam);
  const date = searchParams.get('date') || todayIso();

  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(facilityId)) return;
    setStatus('loading');
    try {
      setFacility(await bookingService.getFacilityDetail(facilityId, date));
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Không thể tải cơ sở.');
    }
  }, [facilityId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const backLink = <Link to={forMatch('/courts')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-brand)' }}>
    <ArrowLeftIcon size={16} color="var(--color-brand)" />
    Quay lại danh sách sân
  </Link>;

  if (status === 'loading') {
    return <div style={{ maxWidth: 1100, margin: '0 auto', padding: 32 }}>{backLink}<StateBlock title="Đang tải..." description="Đang tải thông tin cơ sở." /></div>;
  }
  if (status === 'error' || !facility) {
    return <div style={{ maxWidth: 1100, margin: '0 auto', padding: 32 }}>{backLink}<StateBlock title="Không tải được cơ sở" description={error ?? 'Cơ sở không tồn tại.'} actionLabel="Thử lại" onAction={() => void load()} /></div>;
  }

  return (
    <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <MatchBookingContext />
      {backLink}

      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 26, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>{facility.name}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {[facility.address, facility.ward, facility.district, facility.city].filter(Boolean).join(', ')}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Giờ mở cửa: {formatTimeRange(facility.openingTime, facility.closingTime)} · Hotline: {facility.phone || 'Đang cập nhật'}
        </p>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>
          Danh sách sân ({facility.courts.length})
        </h2>
        {facility.courts.length === 0 && (
          <StateBlock title="Chưa có sân" description="Cơ sở này chưa có sân khả dụng." />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {facility.courts.map((court) => {
            const bookable = court.status === 'ACTIVE';
            return (
              <article key={court.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 18, borderRadius: 14, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: 'var(--bg-tag-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-brand)' }}>
                    <CourtIcon size={18} color="var(--color-brand)" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{court.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Giá từ {formatCurrency(court.priceFrom)}/giờ</span>
                  </div>
                  {!bookable && (
                    <span style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700, backgroundColor: 'var(--bg-tag-red)', color: 'var(--color-danger)' }}>
                      Tạm ngưng
                    </span>
                  )}
                </div>
                {bookable ? (
                  <Link
                    to={forMatch(`/courts/${court.id}?date=${date}`)}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, backgroundColor: 'var(--color-brand)', color: '#FFFFFF', fontWeight: 600, fontSize: 13 }}
                  >
                    Xem lịch trống
                    <ChevronRightIcon size={14} color="#FFFFFF" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    style={{ padding: '9px 14px', borderRadius: 8, backgroundColor: 'var(--bg-table-header)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13 }}
                  >
                    Tạm ngưng đặt sân
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
