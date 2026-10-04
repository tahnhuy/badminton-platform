import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { ApiError } from '../../../shared/api/http-client';
import { BookingListCard } from '../components/BookingListCard';
import { StateBlock } from '../components/StateBlocks';
import { ChevronLeftIcon, ChevronRightIcon } from '../../../components/common/Icons';
import type { BookingSummary, MyBookingsParams, PageMeta } from '../types/booking';

interface TabConfig {
  key: string;
  label: string;
  params: MyBookingsParams;
}

const TABS: TabConfig[] = [
  { key: 'ALL', label: 'Tất cả', params: {} },
  { key: 'UPCOMING', label: 'Sắp diễn ra', params: { timeScope: 'UPCOMING' } },
  { key: 'PENDING_PAYMENT', label: 'Chờ thanh toán', params: { status: 'PENDING_PAYMENT' } },
  { key: 'COMPLETED', label: 'Đã hoàn thành', params: { status: 'COMPLETED' } },
  { key: 'CANCELLED', label: 'Đã hủy / Hoàn tiền', params: { status: 'CANCELLED' } },
];

const PAGE_SIZE = 10;

export function MyBookingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [page, setPage] = useState(1);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (tabKey: string, currentPage: number) => {
    const tab = TABS.find((item) => item.key === tabKey) ?? TABS[0];
    setStatus('loading');
    setError(null);
    try {
      const response = await bookingService.getMyBookings({ ...tab.params, page: currentPage, limit: PAGE_SIZE });
      setBookings(response.data);
      setMeta(response.meta);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Không thể tải danh sách đặt sân.');
    }
  }, []);

  useEffect(() => {
    void load(activeTab, page);
  }, [activeTab, page, load]);

  const changeTab = (key: string) => {
    setActiveTab(key);
    setPage(1);
  };

  return (
    <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 26, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
            Lịch sử đặt sân
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Theo dõi các đơn sắp diễn ra, đã hoàn thành, đã hủy và tình trạng hoàn tiền.</p>
        </div>
        <Link to="/courts" style={{ padding: '10px 18px', borderRadius: 8, backgroundColor: 'var(--color-brand)', color: '#FFFFFF', fontWeight: 600, fontSize: 13 }}>
          + Đặt sân mới
        </Link>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => changeTab(tab.key)}
              style={{
                padding: '8px 14px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 600,
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--color-brand)' : 'var(--bg-table-header)',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {status === 'loading' && <StateBlock title="Đang tải..." description="Vui lòng chờ trong giây lát." />}
      {status === 'error' && error && (
        <StateBlock title="Không tải được danh sách" description={error} actionLabel="Thử lại" onAction={() => void load(activeTab, page)} />
      )}
      {status === 'success' && bookings.length === 0 && (
        <StateBlock
          title="Chưa có đơn đặt sân"
          description="Bạn chưa có đơn nào trong mục này. Hãy khám phá và đặt sân ngay."
          actionLabel="Khám phá sân"
          onAction={() => navigate('/courts')}
        />
      )}
      {status === 'success' && bookings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {bookings.map((booking) => (
            <BookingListCard key={booking.id} booking={booking} onView={(id) => navigate(`/bookings/${id}`)} />
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={meta.page <= 1}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', fontWeight: 600, fontSize: 13 }}
          >
            <ChevronLeftIcon size={14} />
            Trước
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Trang {meta.page} / {meta.totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
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
