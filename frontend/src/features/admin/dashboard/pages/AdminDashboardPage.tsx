import React, { useState } from 'react';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';
import { SyncIcon } from '../../../../components/common/Icons';
import { TimeRangeFilter } from '../../../../components/common/TimeRangeFilter';
import { DashboardChartsGrid } from '../components/DashboardChartsGrid';
import { GrowthChart } from '../components/GrowthChart';
import { KpiBentoGrid } from '../components/KpiBentoGrid';
import { QuickActionLinks } from '../components/QuickActionLinks';
import { RecentActivityTable } from '../components/RecentActivityTable';
import { useDashboard } from '../hooks/use-dashboard';
import { useAdminTimeRange } from '../../contexts/admin-time-range-context';
import '../dashboard.css';

export const AdminDashboardPage: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { range, setRange } = useAdminTimeRange();
  const { kpis, charts, activities, errors, loading, refresh } = useDashboard(range);

  const isRefreshing = loading.kpis || loading.charts || loading.activities;

  return (
    <div className="admin-layout" data-testid="admin-dashboard-page">
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(previous => !previous)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <div className={`admin-main-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <AdminHeader isCollapsed={isCollapsed} onToggleMobileSidebar={() => setIsMobileOpen(true)} />

        <main className="dashboard-main">
          <div className="page-top-header">
            <div className="page-top-header-info">
              <h1 className="page-top-header-title">Bảng điều khiển</h1>
              <p className="page-top-header-desc">
                Tổng quan số liệu vận hành toàn hệ thống: người chơi, cơ sở & sân, đặt sân, giải đấu và báo cáo.
              </p>
            </div>

            <div className="dashboard-toolbar">
              <TimeRangeFilter value={range} onChange={setRange} disabled={isRefreshing} />
              <button
                type="button"
                className="dashboard-refresh-button"
                data-testid="dashboard-refresh"
                onClick={refresh}
                disabled={isRefreshing}
                aria-label="Làm mới dữ liệu dashboard"
              >
                <SyncIcon size={16} color="var(--color-brand)" />
                <span>{isRefreshing ? 'Đang tải…' : 'Làm mới'}</span>
              </button>
            </div>
          </div>

          {errors.kpis ? (
            <div className="dashboard-widget-error" data-testid="kpi-error">
              <span>{errors.kpis}</span>
              <button type="button" onClick={refresh}>Thử lại</button>
            </div>
          ) : (
            <KpiBentoGrid kpis={kpis} isLoading={loading.kpis} />
          )}

          <div className="dashboard-content-grid">
            {errors.charts ? (
              <div className="dashboard-card dashboard-widget-error" data-testid="chart-error">
                <span>{errors.charts}</span>
                <button type="button" onClick={refresh}>Thử lại</button>
              </div>
            ) : loading.charts || !charts ? (
              <div className="dashboard-card dashboard-chart-loading" aria-busy="true">
                <div className="skeleton" style={{ height: 24, width: '40%' }} />
                <div className="skeleton" style={{ height: 240, width: '100%' }} />
              </div>
            ) : (
              <GrowthChart
                newUsers={charts.series.newUsers}
                newBookings={charts.series.newBookings}
              />
            )}

            <QuickActionLinks />
          </div>

          {!errors.charts && charts && !loading.charts && <DashboardChartsGrid charts={charts} />}

          {!errors.charts && loading.charts && (
            <div className="dashboard-extra-charts" aria-busy="true">
              {Array.from({ length: 6 }, (_, index) => (
                <div className="dashboard-card dashboard-mini-chart-loading" key={index}>
                  <div className="skeleton" style={{ height: 20, width: '45%' }} />
                  <div className="skeleton" style={{ height: 150, width: '100%' }} />
                </div>
              ))}
            </div>
          )}

          <section className="dashboard-card dashboard-activity-card">
            <header className="dashboard-card-header">
              <div>
                <h2>Hoạt động gần đây</h2>
                <p>10 hoạt động mới nhất trên nền tảng, không phụ thuộc khoảng thời gian đã chọn.</p>
              </div>
            </header>
            <RecentActivityTable
              items={activities ?? []}
              isLoading={loading.activities}
              error={errors.activities}
            />
          </section>
        </main>
      </div>
    </div>
  );
};
