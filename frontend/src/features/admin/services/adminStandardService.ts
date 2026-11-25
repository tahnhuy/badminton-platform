import { httpClient } from '../../../shared/api/http-client';

export interface StandardClaimItem {
  id: number;
  courtId: number;
  courtName: string;
  facilityId: number;
  facilityName: string;
  ownerId: number;
  standardCode: string;
  standardName: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'INVALIDATED';
  surfaceBrand: string;
  surfaceModel: string;
  issuer: string;
  referenceNo: string;
  issuedAt: string | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  evidenceMediaIds: number[];
}

export interface StandardClaimPage {
  data: StandardClaimItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const ADMIN_STANDARD_CLAIMS_CHANGED_EVENT = 'admin-standard-claims-changed';

export const adminStandardService = {
  list(status: string, page: number, limit = 20) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) query.set('status', status);
    return httpClient<StandardClaimPage>(`/api/v1/admin/standards/claims?${query.toString()}`);
  },
  async decide(id: number, approve: boolean, reason?: string) {
    const result = await httpClient<{ data: unknown }>(`/api/v1/admin/standards/claims/${id}/${approve ? 'approve' : 'reject'}`, {
      method: 'POST',
      body: JSON.stringify(approve ? {} : { reason }),
    });
    window.dispatchEvent(new Event(ADMIN_STANDARD_CLAIMS_CHANGED_EVENT));
    return result;
  },
};
