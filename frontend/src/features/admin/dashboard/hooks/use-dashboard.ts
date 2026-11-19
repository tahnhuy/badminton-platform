import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../../shared/api/http-client';
import { adminDashboardService } from '../services/admin-dashboard-service';
import type { TimeRangeValue } from '../../../../shared/time-range';
import type {
  DashboardActivity,
  DashboardCharts,
  DashboardKpis,
} from '../types/dashboard';

interface DashboardErrors {
  kpis?: string;
  charts?: string;
  activities?: string;
}

interface DashboardLoading {
  kpis: boolean;
  charts: boolean;
  activities: boolean;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useDashboard(range: TimeRangeValue) {
  const [tick, setTick] = useState(0);
  const [kpis, setKpis] = useState<DashboardKpis | undefined>(undefined);
  const [charts, setCharts] = useState<DashboardCharts | undefined>(undefined);
  const [activities, setActivities] = useState<DashboardActivity[] | undefined>(undefined);
  const [errors, setErrors] = useState<DashboardErrors>({});
  const [loading, setLoading] = useState<DashboardLoading>({
    kpis: true,
    charts: true,
    activities: true,
  });

  const metricsRequestRef = useRef(0);
  const activityRequestRef = useRef(0);

  const refresh = useCallback(() => setTick(value => value + 1), []);

  useEffect(() => {
    const requestId = ++metricsRequestRef.current;
    setKpis(undefined);
    setCharts(undefined);
    setErrors(previous => ({ ...previous, kpis: undefined, charts: undefined }));
    setLoading(previous => ({ ...previous, kpis: true, charts: true }));

    Promise.allSettled([
      adminDashboardService.getKpis(range, tick),
      adminDashboardService.getCharts(range, tick),
    ]).then(([kpiResult, chartResult]) => {
      if (requestId !== metricsRequestRef.current) return;

      if (kpiResult.status === 'fulfilled') {
        setKpis(kpiResult.value.data);
        setErrors(previous => ({ ...previous, kpis: undefined }));
      } else {
        setErrors(previous => ({
          ...previous,
          kpis: messageOf(kpiResult.reason, 'Không thể tải các chỉ số KPI.'),
        }));
      }

      if (chartResult.status === 'fulfilled') {
        setCharts(chartResult.value.data);
        setErrors(previous => ({ ...previous, charts: undefined }));
      } else {
        setErrors(previous => ({
          ...previous,
          charts: messageOf(chartResult.reason, 'Không thể tải biểu đồ tăng trưởng.'),
        }));
      }

      setLoading(previous => ({ ...previous, kpis: false, charts: false }));
    });
  }, [range.preset, range.startDate, range.endDate, tick]);

  useEffect(() => {
    const requestId = ++activityRequestRef.current;
    setActivities(undefined);
    setErrors(previous => ({ ...previous, activities: undefined }));
    setLoading(previous => ({ ...previous, activities: true }));

    adminDashboardService
      .getRecentActivities(10, tick)
      .then(response => {
        if (requestId !== activityRequestRef.current) return;
        setActivities(response.data.items);
      })
      .catch(error => {
        if (requestId !== activityRequestRef.current) return;
        setErrors(previous => ({
          ...previous,
          activities: messageOf(error, 'Không thể tải hoạt động gần đây.'),
        }));
      })
      .finally(() => {
        if (requestId !== activityRequestRef.current) return;
        setLoading(previous => ({ ...previous, activities: false }));
      });
  }, [tick]);

  return { kpis, charts, activities, errors, loading, refresh };
}
