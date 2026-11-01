import { httpClient } from '../../../shared/api/http-client';
import type { ExternalCourt, RecruitmentDetail, RecruitmentDraft } from '../types/recruitment';
export const recruitmentApi = {
  detail: async (id: number) => (await httpClient<{ data: RecruitmentDetail }>(`/api/v1/matchmaking-requests/${id}`)).data,
  action: (id: number, action: 'publish' | 'close' | 'withdraw' | 'cancel') => httpClient(`/api/v1/matchmaking-requests/${id}/${action}`, { method: 'POST', ...(action === 'cancel' ? { body: JSON.stringify({ bookingAction: 'KEEP' }) } : {}) }),
  court: (id: number, court: ExternalCourt) => httpClient(`/api/v1/matchmaking-requests/${id}/court`, { method: 'PUT', body: JSON.stringify({ ...court, kind: 'EXTERNAL' }) }),
  edit: (id: number, changes: Partial<Omit<RecruitmentDraft, 'court'>>) => httpClient(`/api/v1/matchmaking-requests/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
};
