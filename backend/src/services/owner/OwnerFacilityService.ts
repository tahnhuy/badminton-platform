import { reviewDto } from '../../repositories/owner/OwnerReviewRepository';
import { z } from 'zod';
import { db } from '../../db';
import { ownerFacilityBody, ownerFacilityUpdate, ownerLocationBody } from '../../validation/owner';
import { ownerFacilityRepository as repo } from '../../repositories/owner/OwnerFacilityRepository';
import { ownerReviewRepository as reviews } from '../../repositories/owner/OwnerReviewRepository';
import { ownerBookingRepository } from '../../repositories/owner/OwnerBookingRepository';
import { OwnerTransaction } from '../../repositories/owner/owner-db';
import { ownerConflict, ownerMissing, paginated } from './owner-errors';
import { timeToMinutes } from '../booking/availability.service';
import { notifyAdmins } from '../notifications/admin-notifications';

const locationKeys = ['address', 'ward', 'district', 'city', 'latitude', 'longitude'] as const;
type FacilityBody = z.infer<typeof ownerFacilityBody>;
function storedValues(input: Partial<FacilityBody>) {
  const { latitude, longitude, ...rest } = input;
  return { ...rest, ...(latitude === undefined ? {} : { latitude: String(latitude) }), ...(longitude === undefined ? {} : { longitude: String(longitude) }) };
}
export const ownerFacilityService = {
  async list(ownerId: number, page: number, limit: number, status?: string) {
    const { rows, total } = await repo.list(ownerId, page, limit, status);
    const data = await Promise.all(rows.map(async row => ({ ...row, courtCount: (await repo.courts(row.id)).length })));
    return paginated(data, total, page, limit);
  },
  async detail(ownerId: number, id: number) {
    const row = await repo.find(ownerId, id);
    if (!row) ownerMissing('FACILITY');
    const [courts, history, pendingAddressReview] = await Promise.all([repo.courts(id), reviews.latest({ facilityId: id }, 'ONBOARDING'), reviews.pending({ facilityId: id }, 'ADDRESS_CHANGE')]);
    return { ...row, courts, latestOnboardingReview: history ? reviewDto(history) : null, pendingAddressReview: pendingAddressReview ? reviewDto(pendingAddressReview) : null };
  },
  async create(ownerId: number, input: FacilityBody) {
    return db.transaction(async tx => {
      const row = await repo.create({ ...input, ...storedValues(input), ward: input.ward ?? null, latitude: String(input.latitude), longitude: String(input.longitude), ownerId, status: 'PENDING_APPROVAL' }, tx);
      const review = await reviews.create({ facilityId: row.id, kind: 'ONBOARDING', submittedValues: row, status: 'PENDING', submittedBy: ownerId }, tx);
      await notifyAdmins(tx, {
        type: 'ADMIN_FACILITY_SUBMITTED',
        title: 'Hồ sơ cơ sở mới chờ duyệt',
        content: `Cơ sở "${row.name}" vừa được gửi để chờ Admin duyệt.`,
        resource: { type: 'ADMIN_FACILITY', id: row.id },
        dedupKey: `admin-facility:${row.id}:${review.id}`,
      });
      return row;
    });
  },
  async update(ownerId: number, id: number, input: z.infer<typeof ownerFacilityUpdate>) {
    return db.transaction(async tx => {
      const row = await repo.lock(ownerId, id, tx);
      if (!row) ownerMissing('FACILITY');
      if (row.status === 'PENDING_APPROVAL') ownerConflict('REVIEW_ALREADY_PENDING', 'Pending submission cannot be edited');
      if (row.status !== 'REJECTED' && locationKeys.some(key => input[key] !== undefined && String(input[key]) !== String(row[key]))) ownerConflict('ADDRESS_CHANGE_REQUIRES_REVIEW', 'Submit a location change for review');
      const opening = input.openingTime ?? row.openingTime;
      const closing = input.closingTime ?? row.closingTime;
      if (timeToMinutes(opening) >= timeToMinutes(closing)) ownerConflict('OPENING_HOURS_CONFLICT', 'Invalid opening hours');
      if ((input.openingTime || input.closingTime) && await ownerBookingRepository.conflictsWithHours(id, opening, closing, tx)) ownerConflict('OPENING_HOURS_CONFLICT', 'Opening hours exclude an effective booking');
      return repo.update(ownerId, id, storedValues(input), tx);
    });
  },
  async resubmit(ownerId: number, id: number) {
    return db.transaction(async tx => {
      const row = await repo.lock(ownerId, id, tx);
      if (!row) ownerMissing('FACILITY');
      if (row.status !== 'REJECTED') ownerConflict('REVIEW_NOT_RESUBMITTABLE', 'Only rejected submissions can be resubmitted');
      const review = await reviews.create({ facilityId: id, kind: 'ONBOARDING', submittedValues: row, status: 'PENDING', submittedBy: ownerId }, tx);
      await repo.update(ownerId, id, { status: 'PENDING_APPROVAL' }, tx);
      await notifyAdmins(tx, {
        type: 'ADMIN_FACILITY_SUBMITTED',
        title: 'Hồ sơ cơ sở gửi lại chờ duyệt',
        content: `Cơ sở "${row.name}" vừa được gửi lại để chờ Admin duyệt.`,
        resource: { type: 'ADMIN_FACILITY', id },
        dedupKey: `admin-facility:${id}:${review.id}`,
      });
      return { id, status: 'PENDING_APPROVAL', reviewId: review.id };
    });
  },
  async addressChange(ownerId: number, id: number, input: z.infer<typeof ownerLocationBody>) {
    return db.transaction(async tx => {
      const row = await repo.lock(ownerId, id, tx);
      if (!row) ownerMissing('FACILITY');
      if (!['ACTIVE', 'SUSPENDED'].includes(row.status)) ownerConflict('ADDRESS_CHANGE_REQUIRES_REVIEW', 'Facility must have completed onboarding');
      if (await reviews.pending({ facilityId: id }, 'ADDRESS_CHANGE', tx)) ownerConflict('REVIEW_ALREADY_PENDING', 'An address proposal is already pending');
      const review = await reviews.create({ facilityId: id, kind: 'ADDRESS_CHANGE', submittedValues: { ...storedValues(input), ward: input.ward ?? null }, status: 'PENDING', submittedBy: ownerId }, tx);
      await notifyAdmins(tx, {
        type: 'ADMIN_FACILITY_SUBMITTED',
        title: 'Yêu cầu đổi địa chỉ chờ duyệt',
        content: `Cơ sở "${row.name}" vừa gửi yêu cầu thay đổi địa chỉ để chờ Admin duyệt.`,
        resource: { type: 'ADMIN_FACILITY', id },
        dedupKey: `admin-facility:${id}:${review.id}`,
      });
      return { reviewId: review.id, status: review.status, proposedValues: review.submittedValues };
    });
  },
  async history(ownerId: number, id: number, page: number, limit: number) {
    if (!await repo.find(ownerId, id)) ownerMissing('FACILITY');
    const { rows, total } = await reviews.list({ facilityId: id }, page, limit);
    return paginated(rows.map(reviewDto), total, page, limit);
  },
};
