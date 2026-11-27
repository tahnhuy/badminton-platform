import { httpClient } from '../../../shared/api/http-client';
import type { TimeRangeValue } from '../../../shared/time-range';
export const ADMIN_FACILITY_REVIEWS_CHANGED_EVENT = 'admin:facility-reviews-changed';
function notifyReviewChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ADMIN_FACILITY_REVIEWS_CHANGED_EVENT));
}
export type FacilityReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type FacilityReviewTarget = 'FACILITY' | 'COURT';
export interface FacilityReview { id: number; kind: string; status: string; rejectionReason: string | null; submittedAt: string; reviewedAt: string | null; submittedValues: Record<string, unknown> }
export interface FacilityReviewQueueItem extends FacilityReview {
  facilityId: number;
  courtId: number | null;
  facilityName: string;
  courtName: string | null;
}
export interface FacilityReviewQueuePage {
  data: FacilityReviewQueueItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export interface FacilityReviewQueueQuery {
  sort?: 'newest' | 'oldest';
  page: number;
  limit: number;
  search?: string;
  status?: FacilityReviewStatus;
  target?: FacilityReviewTarget;
  range: TimeRangeValue;
}
export function facilityReviewQueuePath(query: FacilityReviewQueueQuery): string {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit), range: query.range.preset });
  if (query.sort) params.set('sort', query.sort);
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.target) params.set('target', query.target);
  if (query.range.preset === 'custom') {
    if (query.range.startDate) params.set('startDate', query.range.startDate);
    if (query.range.endDate) params.set('endDate', query.range.endDate);
  }
  return `/api/v1/admin/facilities/reviews?${params.toString()}`;
}
export const facilityReviewService = {
  queue(query: FacilityReviewQueueQuery) {
    return httpClient<FacilityReviewQueuePage>(facilityReviewQueuePath(query));
  },
  pendingCount() {
    return httpClient<{ data: { total: number } }>('/api/v1/admin/facilities/reviews/pending-count');
  },
  async decide(facilityId: number, review: FacilityReview, approve: boolean, reason: string, courtId?: number) {
    const action = approve ? 'approve' : 'reject';
    const prefix = `/api/v1/admin/facilities/${facilityId}`;
    const path = review.kind === 'COURT_DELETION' ? `${prefix}/courts/${courtId}/deletion-requests/${action}` : review.kind === 'ADDRESS_CHANGE' ? `${prefix}/address-change-requests/${review.id}/${action}` : courtId ? `${prefix}/courts/${courtId}/${action}` : `${prefix}/${action}`;
    const result = await httpClient(path, { method: 'POST', body: JSON.stringify({ ...(review.kind === 'ADDRESS_CHANGE' ? {} : { reviewId: review.id }), ...(reason.trim() ? { reason: reason.trim() } : {}) }) });
    notifyReviewChanged();
    return result;
  },
};
