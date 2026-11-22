import React from 'react';
import type { DashboardCharts } from '../types/dashboard';
import { BarListChart, type BarListItem } from './BarListChart';
import { BookingHeatmap } from './BookingHeatmap';
import { ChartCard } from './ChartCard';
import { ReportBreakdownChart } from './ReportBreakdownChart';
import { RevenueChart } from './RevenueChart';

interface DashboardChartsGridProps {
  charts: DashboardCharts;
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang diễn ra',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
};

const BOOKING_STATUS_TONES: Record<string, BarListItem['tone']> = {
  PENDING_PAYMENT: 'warning',
  CONFIRMED: 'success',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  EXPIRED: 'default',
};

const TOURNAMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  OPEN_FOR_REGISTRATION: 'Mở đăng ký',
  REGISTRATION_CLOSED: 'Đóng đăng ký',
  READY: 'Sẵn sàng',
  IN_PROGRESS: 'Đang diễn ra',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const DashboardChartsGrid: React.FC<DashboardChartsGridProps> = ({ charts }) => {
  const bookingStatusItems: BarListItem[] = charts.series.bookingStatuses.map(row => ({
    label: BOOKING_STATUS_LABELS[row.status] ?? row.status,
    value: row.count,
    tone: BOOKING_STATUS_TONES[row.status] ?? 'default',
  }));

  const topFacilityItems: BarListItem[] = charts.series.topFacilities.map(row => ({
    label: row.name,
    value: row.bookings,
    tone: 'info',
  }));

  const tournamentItems: BarListItem[] = charts.series.tournamentStatuses.map(row => ({
    label: TOURNAMENT_STATUS_LABELS[row.status] ?? row.status,
    value: row.count,
    tone: row.status === 'IN_PROGRESS' ? 'info' : row.status === 'COMPLETED' ? 'success' : 'default',
  }));

  return (
    <div className="dashboard-extra-charts grid grid-cols-1 gap-4 min-[1101px]:grid-cols-2" data-testid="dashboard-extra-charts">
      <RevenueChart points={charts.series.revenueByDay} />

      <ChartCard
        title="Trạng thái đặt sân"
        description="Số booking theo trạng thái trong kỳ đã chọn."
        testId="chart-booking-status"
        isEmpty={bookingStatusItems.length === 0}
        footnote="Tính tất cả booking được tạo trong kỳ, không phụ thuộc ngày chơi."
      >
        <BarListChart items={bookingStatusItems} formatValue={value => `${value.toLocaleString('vi-VN')} booking`} />
      </ChartCard>

      <BookingHeatmap cells={charts.series.bookingHeatmap} />

      <ChartCard
        title="Top cơ sở theo lượt đặt"
        description="5 cơ sở có nhiều booking nhất trong kỳ."
        testId="chart-top-facilities"
        isEmpty={topFacilityItems.length === 0}
        footnote="Không bao gồm cơ sở đã xóa mềm."
      >
        <BarListChart
          items={topFacilityItems}
          formatValue={value => `${value.toLocaleString('vi-VN')} lượt`}
        />
      </ChartCard>

      <ReportBreakdownChart items={charts.series.reportBreakdown} />

      <ChartCard
        title="Trạng thái giải đấu"
        description="Phân bố giải đấu hiện tại theo trạng thái."
        testId="chart-tournament-status"
        isEmpty={tournamentItems.length === 0}
        footnote="Số liệu hiện tại, không phụ thuộc khoảng thời gian đã chọn."
      >
        <BarListChart
          items={tournamentItems}
          formatValue={value => `${value.toLocaleString('vi-VN')} giải`}
        />
      </ChartCard>
    </div>
  );
};
