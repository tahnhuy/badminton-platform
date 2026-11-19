import { httpClient } from '../../../../shared/api/http-client';
import type { TimeRangeValue } from '../../../../shared/time-range';
import type { DashboardCharts, DashboardKpis, DashboardActivity } from '../types/dashboard';

const BASE_URL = '/api/v1/admin/dashboard';

export function dashboardQueryString(value: TimeRangeValue): string {
  const params = new URLSearchParams({ range: value.preset });
  if (value.preset === 'custom') {
    if (value.startDate) params.set('startDate', value.startDate);
    if (value.endDate) params.set('endDate', value.endDate);
  }
  return params.toString();
}

export const adminDashboardService = {
  getKpis(value: TimeRangeValue, cacheBust?: number): Promise<{ data: DashboardKpis }> {
    const suffix = cacheBust ? `&_=${cacheBust}` : '';
    return httpClient<{ data: DashboardKpis }>(`${BASE_URL}/kpis?${dashboardQueryString(value)}${suffix}`);
  },

  getCharts(value: TimeRangeValue, cacheBust?: number): Promise<{ data: DashboardCharts }> {
    const suffix = cacheBust ? `&_=${cacheBust}` : '';
    return httpClient<{ data: DashboardCharts }>(`${BASE_URL}/charts?${dashboardQueryString(value)}${suffix}`);
  },

  getRecentActivities(limit = 10, cacheBust?: number): Promise<{ data: { items: DashboardActivity[] } }> {
    const suffix = cacheBust ? `&_=${cacheBust}` : '';
    return httpClient<{ data: { items: DashboardActivity[] } }>(
      `${BASE_URL}/recent-activities?limit=${limit}${suffix}`,
    );
  },
};
