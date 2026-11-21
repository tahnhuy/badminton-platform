import { reviewDto } from '../../repositories/owner/OwnerReviewRepository';
import { db } from '../../db';
import { AppError } from '../../errors/AppError';
import { facilityReviewRepository as repo } from '../../repositories/admin/FacilityReviewRepository';
import { ownerReviewRepository } from '../../repositories/owner/OwnerReviewRepository';
import { ownerLocationBody } from '../../validation/owner';
import { paginated } from '../owner/owner-errors';
import { resolveDashboardRange, type DashboardRangeQuery } from './DashboardService';

function missing(): never { throw new AppError('FACILITY_NOT_FOUND', 404, 'Review target not found'); }
function conflict(): never { throw new AppError('REVIEW_NOT_PENDING', 409, 'Review attempt is not pending'); }
export const facilityReviewService = {
  async list(query: DashboardRangeQuery & { sort?: 'newest' | 'oldest'; search?: string; status?: 'PENDING' | 'APPROVED' | 'REJECTED'; target?: 'FACILITY' | 'COURT' }, page: number, limit: number) {
    const bounds = resolveDashboardRange(query);
    const { rows, total } = await repo.list(page, limit, { sort: query.sort, search: query.search, status: query.status, target: query.target, start: bounds.start, end: bounds.end });
    const items = rows.map(row => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      submittedValues: row.submittedValues,
      rejectionReason: row.rejectionReason,
      submittedAt: row.createdAt,
      reviewedAt: row.reviewedAt,
      facilityId: row.facilityId ?? row.courtFacilityId,
      courtId: row.courtId,
      facilityName: row.facilityName ?? row.courtFacilityName,
      courtName: row.courtName,
    }));
    return paginated(items, total, page, limit);
  },
  pendingCount() {
    return repo.pendingCount();
  },
  async decide(adminId: number, facilityId: number, reviewId: number, approve: boolean, kind: 'ONBOARDING' | 'ADDRESS_CHANGE', reason?: string, courtId?: number) {
    return db.transaction(async tx => {
      const facility = await repo.lockFacility(facilityId, tx);
      if (!facility || facility.deletedAt) missing();
      const court = courtId === undefined ? null : await repo.court(facilityId, courtId, tx);
      if (courtId !== undefined && (!court || court.deletedAt)) missing();
      const review = await repo.lockReview(reviewId, tx);
      if (!review || review.kind !== kind || (courtId === undefined ? review.facilityId !== facilityId : review.courtId !== courtId)) missing();
      if (review.status !== 'PENDING') conflict();
      if (!approve && !reason?.trim()) throw new AppError('VALIDATION_FAILED', 400, 'Rejection reason is required');
      if (kind === 'ONBOARDING') {
        if ((court ?? facility).status !== 'PENDING_APPROVAL') conflict();
        if (courtId === undefined) await repo.facilityStatus(facilityId, approve ? 'ACTIVE' : 'REJECTED', tx);
        else await repo.courtStatus(courtId, approve ? 'ACTIVE' : 'REJECTED', tx);
      } else if (approve) {
        const proposed = ownerLocationBody.parse(review.submittedValues);
        await repo.location(facilityId, { ...proposed, latitude: String(proposed.latitude), longitude: String(proposed.longitude) }, tx);
      }
      return repo.decide(reviewId, adminId, approve, reason?.trim(), tx);
    });
  },
  async history(facilityId: number, page: number, limit: number, courtId?: number) {
    await db.transaction(async tx => {
      const facility = await repo.lockFacility(facilityId, tx);
      if (!facility || (courtId !== undefined && !await repo.court(facilityId, courtId, tx))) missing();
    });
    const { rows, total } = await ownerReviewRepository.list(courtId === undefined ? { facilityId } : { courtId }, page, limit);
    return paginated(rows.map(reviewDto), total, page, limit);
  },
};
