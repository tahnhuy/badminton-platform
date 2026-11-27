import { reviewDto } from '../../repositories/owner/OwnerReviewRepository';
import { db } from '../../db';
import { ownerCourtRepository as repo } from '../../repositories/owner/OwnerCourtRepository';
import { ownerFacilityRepository as facilities } from '../../repositories/owner/OwnerFacilityRepository';
import { ownerReviewRepository as reviews } from '../../repositories/owner/OwnerReviewRepository';
import { ownerConflict, ownerMissing, paginated } from './owner-errors';
import { notifyAdmins } from '../notifications/admin-notifications';

export const ownerCourtService = {
  async create(ownerId: number, facilityId: number, input: { name: string; description?: string }) {
    return db.transaction(async tx => {
      if (!await facilities.lock(ownerId, facilityId, tx)) ownerMissing('FACILITY');
      const row = await repo.create({ ...input, facilityId, status: 'PENDING_APPROVAL' }, tx);
      const review = await reviews.create({ courtId: row.id, kind: 'ONBOARDING', submittedValues: row, status: 'PENDING', submittedBy: ownerId }, tx);
      await notifyAdmins(tx, {
        type: 'ADMIN_FACILITY_SUBMITTED',
        title: 'Sân mới chờ duyệt',
        content: `Sân "${row.name}" vừa được gửi để chờ Admin duyệt.`,
        resource: { type: 'ADMIN_FACILITY', id: facilityId },
        dedupKey: `admin-court:${row.id}:${review.id}`,
      });
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
  async requestDeletion(ownerId: number, id: number, reason: string) {
    return db.transaction(async tx => {
      const row = await repo.find(ownerId, id, tx);
      if (!row) ownerMissing('COURT');
      await facilities.lock(ownerId, row.facility.id, tx);
      const current = await repo.find(ownerId, id, tx);
      if (!current) ownerMissing('COURT');
      if (current.court.status === 'PENDING_APPROVAL' || await reviews.pending({ courtId: id }, 'COURT_DELETION', tx)) {
        ownerConflict('REVIEW_ALREADY_PENDING', 'Đã có hồ sơ chờ duyệt.');
      }
      const review = await reviews.create({ courtId: id, kind: 'COURT_DELETION',
        submittedValues: { name: current.court.name, reason }, status: 'PENDING', submittedBy: ownerId }, tx);
      await notifyAdmins(tx, {
        type: 'ADMIN_FACILITY_SUBMITTED', title: 'Yêu cầu xóa sân chờ duyệt',
        content: `Chủ sân yêu cầu xóa sân "${current.court.name}" của cơ sở "${current.facility.name}".`,
        resource: { type: 'ADMIN_FACILITY', id: current.facility.id },
        dedupKey: `admin-court-deletion:${review.id}`,
      });
      return reviewDto(review);
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
      await notifyAdmins(tx, {
        type: 'ADMIN_FACILITY_SUBMITTED',
        title: 'Sân gửi lại chờ duyệt',
        content: `Sân "${current.court.name}" vừa được gửi lại để chờ Admin duyệt.`,
        resource: { type: 'ADMIN_FACILITY', id: current.court.facilityId },
        dedupKey: `admin-court:${id}:${review.id}`,
      });
      return { id, status: 'PENDING_APPROVAL', reviewId: review.id };
    });
  },
  async history(ownerId: number, id: number, page: number, limit: number) {
    if (!await repo.find(ownerId, id)) ownerMissing('COURT');
    const { rows, total } = await reviews.list({ courtId: id }, page, limit);
    return paginated(rows.map(reviewDto), total, page, limit);
  },
};
