import { httpClient } from '../../../../shared/api/http-client';
import type { TimeRangeValue } from '../../../../shared/time-range';
import type { DashboardCharts, DashboardKpis, DashboardActivity, DashboardRange } from '../types/dashboard';

const BASE_URL = '/api/v1/admin/dashboard';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const arraysOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/**
 * The dashboard must degrade to the "no data" state instead of crashing when a
 * response is empty or missing `series`. Every chart consumes an array, so we
 * normalize the payload at the API boundary and keep the page/type contract.
 */
export function normalizeDashboardCharts(raw: unknown, fallbackRange: DashboardRange): DashboardCharts {
  const payload = isRecord(raw) ? raw : {};
  const series = isRecord(payload.series) ? payload.series : {};
  return {
    range: typeof payload.range === 'string' ? (payload.range as DashboardRange) : fallbackRange,
    series: {
      newUsers: arraysOf(series.newUsers),
      newBookings: arraysOf(series.newBookings),
      revenueByDay: arraysOf(series.revenueByDay),
      bookingStatuses: arraysOf(series.bookingStatuses),
      bookingHeatmap: arraysOf(series.bookingHeatmap),
      topFacilities: arraysOf(series.topFacilities),
      reportBreakdown: arraysOf(series.reportBreakdown),
      tournamentStatuses: arraysOf(series.tournamentStatuses),
    },
  };
}

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

  async getCharts(value: TimeRangeValue, cacheBust?: number): Promise<{ data: DashboardCharts }> {
    const suffix = cacheBust ? `&_=${cacheBust}` : '';
    const response = await httpClient<{ data: unknown }>(`${BASE_URL}/charts?${dashboardQueryString(value)}${suffix}`);
    return { data: normalizeDashboardCharts(response?.data, value.preset) };
  },

  getRecentActivities(limit = 10, cacheBust?: number): Promise<{ data: { items: DashboardActivity[] } }> {
    const suffix = cacheBust ? `&_=${cacheBust}` : '';
    return httpClient<{ data: { items: DashboardActivity[] } }>(
      `${BASE_URL}/recent-activities?limit=${limit}${suffix}`,
    );
  },
};
