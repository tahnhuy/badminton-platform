import React from 'react';
import { Link } from 'react-router-dom';
import { DataTable, type ColumnDef } from '@/components/common/data-table';
import type { DashboardActivity, DashboardActivityType } from '../types/dashboard';

interface RecentActivityTableProps {
  items: DashboardActivity[];
  isLoading: boolean;
  error?: string;
}

const TYPE_LABELS: Record<DashboardActivityType, string> = {
  BOOKING: 'Đặt sân',
  TOURNAMENT: 'Giải đấu',
  REPORT: 'Báo cáo',
  FACILITY: 'Cơ sở',
};

const TYPE_TONES: Record<DashboardActivityType, string> = {
  BOOKING: 'success',
  TOURNAMENT: 'info',
  REPORT: 'danger',
  FACILITY: 'warning',
};

function targetLink(item: DashboardActivity): string | null {
  switch (item.type) {
    case 'REPORT':
      return `/admin/reports?reportId=${item.targetId}`;
    case 'FACILITY':
      return '/admin/courts';
    default:
      return null;
  }
}

function formatOccurredAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

export const RecentActivityTable: React.FC<RecentActivityTableProps> = ({ items, isLoading, error }) => {
  const columns: ColumnDef<DashboardActivity>[] = [
    {
      key: 'type',
      header: 'Loại',
      width: 120,
      render: item => (
        <span className={`dashboard-activity-badge inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground [&.success]:bg-primary/10 [&.success]:text-primary [&.info]:bg-info/10 [&.info]:text-info [&.danger]:bg-destructive/10 [&.danger]:text-destructive [&.warning]:bg-caution/10 [&.warning]:text-caution ${TYPE_TONES[item.type]}`}>
          {TYPE_LABELS[item.type]}
        </span>
      ),
    },
    {
      key: 'summary',
      header: 'Hoạt động',
      render: item => {
        const link = targetLink(item);
        return link ? (
          <Link className="dashboard-activity-link font-semibold text-primary hover:underline" to={link}>{item.summary}</Link>
        ) : (
          <span>{item.summary}</span>
        );
      },
    },
    {
      key: 'occurredAt',
      header: 'Thời gian',
      width: 190,
      render: item => <span className="dashboard-activity-time text-sm text-muted-foreground">{formatOccurredAt(item.occurredAt)}</span>,
    },
  ];

  if (error) {
    return (
      <div className="dashboard-widget-error flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm font-semibold text-destructive [&_button]:rounded-lg [&_button]:border [&_button]:border-destructive/30 [&_button]:bg-card [&_button]:px-3 [&_button]:py-1.5" data-testid="recent-activity-error">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div data-testid="recent-activity">
      <DataTable
        data={items}
        columns={columns}
        keyExtractor={item => `${item.type}-${item.targetId}`}
        isLoading={isLoading}
        skeletonRows={5}
        emptyState={(
          <div className="dashboard-activity-empty flex flex-col gap-1 text-muted-foreground [&_strong]:text-sm [&_strong]:text-foreground">
            <strong>Chưa có hoạt động gần đây</strong>
            <span>Hoạt động mới sẽ xuất hiện khi có đặt sân, giải đấu, báo cáo hoặc cơ sở mới.</span>
          </div>
        )}
      />
    </div>
  );
};
