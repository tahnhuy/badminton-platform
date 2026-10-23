import { httpClient } from '../../../shared/api/http-client';
export interface FacilityReview { id: number; kind: string; status: string; rejectionReason: string | null; submittedAt: string; reviewedAt: string | null; submittedValues: Record<string, unknown> }
export const facilityReviewService = {
  decide(facilityId: number, review: FacilityReview, approve: boolean, reason: string, courtId?: number) {
    const action = approve ? 'approve' : 'reject';
    const prefix = `/api/v1/admin/facilities/${facilityId}`;
    const path = review.kind === 'ADDRESS_CHANGE' ? `${prefix}/address-change-requests/${review.id}/${action}` : courtId ? `${prefix}/courts/${courtId}/${action}` : `${prefix}/${action}`;
    return httpClient(path, { method: 'POST', body: JSON.stringify({ ...(review.kind === 'ADDRESS_CHANGE' ? {} : { reviewId: review.id }), ...(reason.trim() ? { reason: reason.trim() } : {}) }) });
  },
};
