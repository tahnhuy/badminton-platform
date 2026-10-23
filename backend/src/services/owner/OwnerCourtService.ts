import { reviewDto } from '../../repositories/owner/OwnerReviewRepository';
import { db } from '../../db';
import { ownerCourtRepository as repo } from '../../repositories/owner/OwnerCourtRepository';
import { ownerFacilityRepository as facilities } from '../../repositories/owner/OwnerFacilityRepository';
import { ownerReviewRepository as reviews } from '../../repositories/owner/OwnerReviewRepository';
import { ownerConflict, ownerMissing, paginated } from './owner-errors';

export const ownerCourtService = {
  async create(ownerId: number, facilityId: number, input: { name: string; description?: string }) {
    return db.transaction(async tx => {
      if (!await facilities.lock(ownerId, facilityId, tx)) ownerMissing('FACILITY');
      const row = await repo.create({ ...input, facilityId, status: 'PENDING_APPROVAL' }, tx);
      await reviews.create({ courtId: row.id, kind: 'ONBOARDING', submittedValues: row, status: 'PENDING', submittedBy: ownerId }, tx);
      return row;
    });
  },
  async update(ownerId: number, id: number, input: { name: string; description?: string }) {
    return db.transaction(async tx => {
      const row = await repo.find(ownerId, id, tx);
      if (!row) ownerMissing('COURT');
      await facilities.lock(ownerId, row.facility.id, tx);
      const current = await repo.find(ownerId, id, tx);
      if (!current) ownerMissing('COURT');
      if (current.court.status === 'PENDING_APPROVAL') ownerConflict('REVIEW_ALREADY_PENDING', 'Pending submission cannot be edited');
      return repo.update(id, input, tx);
    });
  },
  async resubmit(ownerId: number, id: number) {
    return db.transaction(async tx => {
      const row = await repo.find(ownerId, id, tx);
      if (!row) ownerMissing('COURT');
      await facilities.lock(ownerId, row.facility.id, tx);
      const current = await repo.find(ownerId, id, tx);
      if (!current) ownerMissing('COURT');
      if (current.court.status !== 'REJECTED') ownerConflict('REVIEW_NOT_RESUBMITTABLE', 'Only rejected submissions can be resubmitted');
      const review = await reviews.create({ courtId: id, kind: 'ONBOARDING', submittedValues: current.court, status: 'PENDING', submittedBy: ownerId }, tx);
      await repo.update(id, { status: 'PENDING_APPROVAL' }, tx);
      return { id, status: 'PENDING_APPROVAL', reviewId: review.id };
    });
  },
  async history(ownerId: number, id: number, page: number, limit: number) {
    if (!await repo.find(ownerId, id)) ownerMissing('COURT');
    const { rows, total } = await reviews.list({ courtId: id }, page, limit);
    return paginated(rows.map(reviewDto), total, page, limit);
  },
};
