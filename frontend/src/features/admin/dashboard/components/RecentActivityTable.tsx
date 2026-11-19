import React from 'react';
import { Link } from 'react-router-dom';
import { DataTable, type ColumnDef } from '../../../../components/common/DataTable';
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
        <span className={`dashboard-activity-badge ${TYPE_TONES[item.type]}`}>
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
          <Link className="dashboard-activity-link" to={link}>{item.summary}</Link>
        ) : (
          <span>{item.summary}</span>
        );
      },
    },
    {
      key: 'occurredAt',
      header: 'Thời gian',
      width: 190,
      render: item => <span className="dashboard-activity-time">{formatOccurredAt(item.occurredAt)}</span>,
    },
  ];

  if (error) {
    return (
      <div className="dashboard-widget-error" data-testid="recent-activity-error">
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
          <div className="dashboard-activity-empty">
            <strong>Chưa có hoạt động gần đây</strong>
            <span>Hoạt động mới sẽ xuất hiện khi có đặt sân, giải đấu, báo cáo hoặc cơ sở mới.</span>
          </div>
        )}
      />
    </div>
  );
};
