import React from 'react';
import {
  CheckShieldIcon,
  CourtIcon,
  ReportIcon,
  TournamentIcon,
  UsersIcon,
  WalletIcon,
} from '../../../../components/common/Icons';
import type { DashboardKpis } from '../types/dashboard';
import { MetricCard } from './MetricCard';

interface KpiBentoGridProps {
  kpis?: DashboardKpis;
  isLoading: boolean;
}

function formatNumber(value: number): string {
  return value.toLocaleString('vi-VN');
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return numeric.toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });
}

export const KpiBentoGrid: React.FC<KpiBentoGridProps> = ({ kpis, isLoading }) => {
  const users = kpis?.users;
  const facilities = kpis?.facilities;
  const bookings = kpis?.bookings;
  const revenue = kpis?.revenue;
  const tournaments = kpis?.tournaments;
  const reports = kpis?.reports;

  return (
    <div className="dashboard-kpi-grid grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy={isLoading}>
      <MetricCard
        label="Người chơi"
        value={users ? formatNumber(users.totalPlayers) : '—'}
        icon={<UsersIcon size={20} color="var(--color-brand)" />}
        tone="success"
        isLoading={isLoading}
        stats={[
          { label: 'Mới trong kỳ', value: users ? `+${formatNumber(users.newUsers)}` : '—', tone: 'success' },
          { label: 'Tỷ lệ hoạt động', value: users ? formatPercent(users.activeUserRate) : '—' },
        ]}
        footnote="Chỉ tính tài khoản PLAYER chưa xóa mềm."
      />

      {renderFacilitiesKpi(facilities, isLoading)}

      <MetricCard
        label="Chờ phê duyệt"
        value={facilities ? formatNumber(facilities.pendingApproval) : '—'}
        icon={<CheckShieldIcon size={20} color="var(--color-caution)" />}
        tone="warning"
        isLoading={isLoading}
        footnote="Cơ sở do chủ sân gửi đang chờ Admin duyệt."
      />

      <MetricCard
        label="Đặt sân & doanh thu ước tính"
        value={bookings ? formatNumber(bookings.totalBookings) : '—'}
        icon={<WalletIcon size={20} color="var(--color-brand-accent)" />}
        isLoading={isLoading}
        stats={[
          { label: 'Tỷ lệ lấp sân', value: bookings ? formatPercent(bookings.slotFillRate) : '—' },
          {
            label: 'Giá trị ước tính',
            value: revenue ? formatCurrency(revenue.estimatedValue) : '—',
            tone: 'success',
          },
        ]}
        footnote="Doanh thu là ước tính từ thanh toán thành công, không phải số liệu kế toán."
      />

      <MetricCard
        label="Giải đấu"
        value={tournaments ? formatNumber(tournaments.inProgress) : '—'}
        icon={<TournamentIcon size={20} color="var(--color-info)" />}
        isLoading={isLoading}
        stats={[
          {
            label: 'Người tham gia',
            value: tournaments ? formatNumber(tournaments.participants) : '—',
          },
        ]}
        footnote="Giải đang diễn ra và người chơi đã xác nhận trong kỳ."
      />

      {renderReportsKpi(reports, isLoading)}
    </div>
  );
};

function renderFacilitiesKpi(facilities: { totalFacilities: number; totalCourts: number; active: number; suspended: number; pendingApproval: number; } | undefined, isLoading: boolean) {
  return <MetricCard
    label="Cơ sở & sân"
    value={facilities ? formatNumber(facilities.totalFacilities) : '—'}
    icon={<CourtIcon size={20} color="var(--color-info)" />}
    isLoading={isLoading}
    stats={[
      { label: 'Tổng số sân', value: facilities ? formatNumber(facilities.totalCourts) : '—' },
      { label: 'ACTIVE', value: facilities ? formatNumber(facilities.active) : '—', tone: 'success' },
      { label: 'Tạm ngưng', value: facilities ? formatNumber(facilities.suspended) : '—', tone: 'warning' },
    ]} />;
}

function renderReportsKpi(reports: { unresolved: number; } | undefined, isLoading: boolean) {
  return <MetricCard
    label="Báo cáo chưa xử lý"
    value={reports ? formatNumber(reports.unresolved) : '—'}
    icon={<ReportIcon size={20} color="var(--color-danger)" />}
    tone={reports && reports.unresolved > 0 ? 'danger' : 'default'}
    isLoading={isLoading}
    footnote="Báo cáo vi phạm đang ở trạng thái OPEN." />;
}
