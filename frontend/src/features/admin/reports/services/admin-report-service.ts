import { httpClient } from '../../../../shared/api/http-client';
import type { AdminReport, AdminReportDetail, ReportPageMeta, ReportStatus, ReportTargetType } from '../types/report';

const BASE = '/api/v1/admin/reports';

export const ADMIN_REPORTS_CHANGED_EVENT = 'admin:reports-changed';

export interface ReportListParams {
  sort?: 'newest' | 'oldest';
  page?: number;
  limit?: number;
  targetType?: ReportTargetType;
  status?: ReportStatus;
  startDate?: string;
  endDate?: string;
}

export const adminReportService = {
  list(params: ReportListParams = {}) {
    const query = new URLSearchParams();
    if (params.sort) query.set('sort', params.sort);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.targetType) query.set('targetType', params.targetType);
    if (params.status) query.set('status', params.status);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const suffix = query.toString();
    return httpClient<{ data: AdminReport[]; meta: ReportPageMeta }>(`${BASE}${suffix ? `?${suffix}` : ''}`);
  },

  async get(id: string): Promise<AdminReportDetail> {
    return (await httpClient<{ data: AdminReportDetail }>(`${BASE}/${id}`)).data;
  },

  async resolve(id: string): Promise<AdminReport> {
    return (await httpClient<{ data: AdminReport }>(`${BASE}/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'RESOLVED' }),
    })).data;
  },

  hidePost(id: string) {
    return httpClient<{ data: unknown }>(`/api/v1/admin/posts/${id}/hide`, { method: 'POST' });
  },

  hideComment(id: string) {
    return httpClient<{ data: unknown }>(`/api/v1/admin/comments/${id}/hide`, { method: 'POST' });
  },
};
