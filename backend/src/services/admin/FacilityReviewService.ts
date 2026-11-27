import type { TransactionContext } from '../../contracts/TransactionContext';
import { reviewDto } from '../../repositories/owner/OwnerReviewRepository';
import { db } from '../../db';
import { AppError } from '../../errors/AppError';
import { facilityReviewRepository as repo } from '../../repositories/admin/FacilityReviewRepository';
import { ownerReviewRepository } from '../../repositories/owner/OwnerReviewRepository';
import { ownerLocationBody } from '../../validation/owner';
import { paginated } from '../owner/owner-errors';
import { resolveDashboardRange, type DashboardRangeQuery } from './DashboardService';
import { cleanNotificationReason, notifyCourtOwner, notifyFacilityOwner } from '../notifications/owner-notifications';
import { userRepository } from '../../repositories/user/UserRepository';

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
  async decide(adminId: number, facilityId: number, reviewId: number, approve: boolean, kind: 'ONBOARDING' | 'ADDRESS_CHANGE' | 'COURT_DELETION', reason?: string, courtId?: number) {
    return db.transaction(async tx => {
      const facility = await repo.lockFacility(facilityId, tx);
      if (!facility || facility.deletedAt) missing();
      await userRepository.lockUsersAscending([facility.ownerId], tx);
      const court = courtId === undefined ? null : await repo.court(facilityId, courtId, tx);
      if (courtId !== undefined && (!court || court.deletedAt)) missing();
      const review = await repo.lockReview(reviewId, tx);
      if (!review || review.kind !== kind || (courtId === undefined ? review.facilityId !== facilityId : review.courtId !== courtId)) missing();
      if (review.status !== 'PENDING') conflict();
      if (!approve && !reason?.trim()) throw new AppError('VALIDATION_FAILED', 400, 'Rejection reason is required');
      await applyReviewDecision(kind, court, facility, courtId, facilityId, approve, tx, review);
      const decided = await repo.decide(reviewId, adminId, approve, reason?.trim(), tx);
      const cleanReason = cleanNotificationReason(reason);
      const result = approve ? 'đã được duyệt' : 'đã bị từ chối';
      await notifyReviewDecision(courtId, kind, tx, facilityId, facility, approve, result, cleanReason, reviewId, court);
      return decided;
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

async function applyReviewDecision(
  kind: string,
  court: { id: number; facilityId: number; name: string; status: string; description: string | null; surfaceType: string | null; surfaceBrand: string | null; surfaceModel: string | null; surfaceThicknessMm: string | null; condition: string | null; conditionNote: string | null; profileVersion: number; dataSource: string | null; sourceRef: string | null; confirmedAt: Date | null; confirmedBy: number | null; deletedAt: Date | null; createdAt: Date; updatedAt: Date; } | null,
  facility: { id: number; ownerId: number; name: string; description: string | null; phone: string; status: string; address: string; ward: string | null; district: string; city: string; openingTime: string; closingTime: string; dataSource: string | null; sourceRef: string | null; confirmedAt: Date | null; confirmedBy: number | null; deletedAt: Date | null; createdAt: Date; updatedAt: Date; },
  courtId: number | undefined,
  facilityId: number,
  approve: boolean,
  tx: TransactionContext,
  review: { id: number; facilityId: number | null; courtId: number | null; kind: string; submittedValues: Record<string, unknown>; status: string; submittedBy: number; reviewedBy: number | null; rejectionReason: string | null; createdAt: Date; reviewedAt: Date | null; },
) {
  if (kind === 'COURT_DELETION') {
    if (!court || courtId === undefined) missing();
    if (approve) {
      if (review.submittedBy !== facility.ownerId) throw new AppError('COURT_DELETION_STALE', 409, 'Chủ sở hữu sân đã thay đổi.');
      if (!await repo.deleteCourt(courtId, tx)) throw new AppError('COURT_DELETION_ACTIVE_BOOKINGS', 409, 'Sân còn booking sắp diễn ra hoặc đang chơi. Vui lòng xử lý lịch trước khi duyệt xóa.');
    }
  } else if (kind === 'ONBOARDING') {
    if ((court ?? facility).status !== 'PENDING_APPROVAL') conflict();
    if (courtId === undefined) await repo.facilityStatus(facilityId, approve ? 'ACTIVE' : 'REJECTED', tx);
    else await repo.courtStatus(courtId, approve ? 'ACTIVE' : 'REJECTED', tx);
  } else if (approve) {
    const proposed = ownerLocationBody.parse(review.submittedValues);
    await repo.location(facilityId, proposed, tx);
  }
}

async function notifyReviewDecision(
  courtId: number | undefined,
  kind: string,
  tx: TransactionContext,
  facilityId: number,
  facility: { id: number; ownerId: number; name: string; description: string | null; phone: string; status: string; address: string; ward: string | null; district: string; city: string; openingTime: string; closingTime: string; dataSource: string | null; sourceRef: string | null; confirmedAt: Date | null; confirmedBy: number | null; deletedAt: Date | null; createdAt: Date; updatedAt: Date; },
  approve: boolean,
  result: string,
  cleanReason: string | undefined,
  reviewId: number,
  court: { id: number; facilityId: number; name: string; status: string; description: string | null; surfaceType: string | null; surfaceBrand: string | null; surfaceModel: string | null; surfaceThicknessMm: string | null; condition: string | null; conditionNote: string | null; profileVersion: number; dataSource: string | null; sourceRef: string | null; confirmedAt: Date | null; confirmedBy: number | null; deletedAt: Date | null; createdAt: Date; updatedAt: Date; } | null,
) {
  if (kind === 'COURT_DELETION' && court) {
    await notifyFacilityOwner(tx, facilityId, facility.ownerId, {
      type: approve ? 'OWNER_COURT_REVIEW_APPROVED' : 'OWNER_COURT_REVIEW_REJECTED',
      title: approve ? 'Yêu cầu xóa sân đã được duyệt' : 'Yêu cầu xóa sân bị từ chối',
      content: `Yêu cầu xóa sân "${court.name}" ${result}${cleanReason ? `: ${cleanReason}` : '.'}`,
      resource: { type: 'OWNER_FACILITY', id: facilityId }, dedupKey: `owner-court-deletion:${reviewId}`,
    });
  } else if (courtId === undefined) {
    await notifyFacilityReviewDecision(kind, tx, facilityId, facility, approve, result, cleanReason, reviewId);
  } else if (court) {
    await notifyCourtOwner(tx, court.id, facility.ownerId, {
      type: approve ? 'OWNER_COURT_REVIEW_APPROVED' : 'OWNER_COURT_REVIEW_REJECTED',
      title: approve ? 'Sân đã được duyệt' : 'Sân bị từ chối',
      content: `Hồ sơ sân "${court.name}" của cơ sở "${facility.name}" ${result}${cleanReason ? `: ${cleanReason}` : '.'}`,
      resource: { type: 'OWNER_COURT', id: court.id },
      dedupKey: `owner-court-review:${reviewId}`,
    });
  }
}

async function notifyFacilityReviewDecision(
  kind: string,
  tx: TransactionContext,
  facilityId: number,
  facility: { id: number; ownerId: number; name: string; description: string | null; phone: string; status: string; address: string; ward: string | null; district: string; city: string; openingTime: string; closingTime: string; dataSource: string | null; sourceRef: string | null; confirmedAt: Date | null; confirmedBy: number | null; deletedAt: Date | null; createdAt: Date; updatedAt: Date; },
  approve: boolean,
  result: string,
  cleanReason: string | undefined,
  reviewId: number,
) {
  const kindLabel = kind === 'ONBOARDING' ? 'Hồ sơ cơ sở' : 'Yêu cầu đổi địa chỉ cơ sở';
  await notifyFacilityOwner(tx, facilityId, facility.ownerId, {
    type: approve ? 'OWNER_FACILITY_REVIEW_APPROVED' : 'OWNER_FACILITY_REVIEW_REJECTED',
    title: approve ? 'Hồ sơ cơ sở đã được duyệt' : 'Hồ sơ cơ sở bị từ chối',
    content: `${kindLabel} "${facility.name}" ${result}${cleanReason ? `: ${cleanReason}` : '.'}`,
    resource: { type: 'OWNER_FACILITY', id: facilityId },
    dedupKey: `owner-facility-review:${reviewId}`,
  });
}
