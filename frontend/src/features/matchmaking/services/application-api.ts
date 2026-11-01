import { httpClient } from '../../../shared/api/http-client';
import type { Application } from '../types/application';
export const applicationApi = {
  create: (requestId: number) => httpClient<{ data: Application }>(`/api/v1/matchmaking-requests/${requestId}/applications`, { method: 'POST', body: '{}' }),
  decide: (id: number, decision: 'ACCEPTED' | 'DECLINED') => httpClient(`/api/v1/matchmaking-applications/${id}`, { method: 'PUT', body: JSON.stringify({ decision }) }),
  cancel: (id: number) => httpClient(`/api/v1/matchmaking-applications/${id}/cancel`, { method: 'POST' }),
};
