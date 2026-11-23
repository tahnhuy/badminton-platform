import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { ApiError } from '../../../shared/api/http-client';
import { BookingListCard } from '../components/BookingListCard';
import { StateBlock } from '../components/StateBlocks';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { Button } from '@/components/ui/button';
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

  return <PageContainer>
    <PageHeader title="Lịch sử đặt sân" description="Theo dõi các đơn sắp diễn ra, đã hoàn thành, đã hủy và tình trạng hoàn tiền."
      actions={<Button asChild variant="brand"><Link to="/courts"><Plus aria-hidden="true" />Đặt sân mới</Link></Button>} />
    <div role="group" aria-label="Lọc đơn đặt sân" className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
      {TABS.map(tab => <Button key={tab.key} type="button" variant={tab.key === activeTab ? 'default' : 'ghost'}
        aria-pressed={tab.key === activeTab} onClick={() => changeTab(tab.key)} className="h-11 rounded-lg px-4">{tab.label}</Button>)}
    </div>
    {status === 'loading' && <StateBlock title="Đang tải..." description="Vui lòng chờ trong giây lát." />}
    {status === 'error' && error && <StateBlock title="Không tải được danh sách" description={error} actionLabel="Thử lại" onAction={() => void load(activeTab, page)} />}
    {status === 'success' && bookings.length === 0 && <StateBlock title="Chưa có đơn đặt sân" description="Bạn chưa có đơn nào trong mục này. Hãy khám phá và đặt sân ngay." actionLabel="Khám phá sân" onAction={() => navigate('/courts')} />}
    {status === 'success' && bookings.length > 0 && <section aria-label="Các đơn đặt sân" className="flex flex-col gap-4">
      {bookings.map(booking => <BookingListCard key={booking.id} booking={booking} onView={id => navigate(`/bookings/${id}`)} />)}
    </section>}
    {meta && meta.totalPages > 1 && <nav aria-label="Phân trang lịch sử đặt sân" className="flex items-center justify-center gap-3">
      <Button type="button" variant="outline" onClick={() => setPage(prev => Math.max(1, prev - 1))} disabled={meta.page <= 1}><ChevronLeft aria-hidden="true" />Trước</Button>
      <span className="text-sm text-muted-foreground">Trang {meta.page} / {meta.totalPages}</span>
      <Button type="button" variant="outline" onClick={() => setPage(prev => Math.min(meta.totalPages, prev + 1))} disabled={meta.page >= meta.totalPages}>Sau<ChevronRight aria-hidden="true" /></Button>
    </nav>}
  </PageContainer>;
}
