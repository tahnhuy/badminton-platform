import { httpClient } from '../../../shared/api/http-client';

export type ReportTargetType = 'POST' | 'COMMENT' | 'MESSAGE';

export interface CreateReportPayload {
  targetType: ReportTargetType;
  targetId: number;
  attachmentId?: number;
  reasonCode: string;
  description?: string;
}

export const reportsApi = {
  create: (payload: CreateReportPayload) =>
    httpClient<{ data: { id: string } }>('/api/v1/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
