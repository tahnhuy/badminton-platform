import { alias } from 'drizzle-orm/pg-core';
import { and, count, desc, eq, gte, ilike, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { courtOwnerReviews, facilities, courts, db } from '../../db';
import { OwnerTransaction } from '../owner/owner-db';
export const facilityReviewRepository = {
  async list(page: number, limit: number, filters: { search?: string; status?: string; target?: 'FACILITY' | 'COURT'; start: Date; end: Date }) {
    const reviewFacility = alias(facilities, 'review_facility');
    const courtFacility = alias(facilities, 'review_court_facility');
    const pattern = filters.search ? `%${filters.search}%` : undefined;
    const where = and(
      gte(courtOwnerReviews.createdAt, filters.start),
      lt(courtOwnerReviews.createdAt, filters.end),
      filters.status ? eq(courtOwnerReviews.status, filters.status) : undefined,
      filters.target === 'COURT' ? isNotNull(courtOwnerReviews.courtId) : filters.target === 'FACILITY' ? isNull(courtOwnerReviews.courtId) : undefined,
      pattern ? or(ilike(reviewFacility.name, pattern), ilike(courtFacility.name, pattern), ilike(courts.name, pattern)) : undefined,
    );
    const [rows, [total]] = await Promise.all([
      db.select({
        id: courtOwnerReviews.id,
        facilityId: courtOwnerReviews.facilityId,
        courtId: courtOwnerReviews.courtId,
        courtFacilityId: courts.facilityId,
        facilityName: reviewFacility.name,
        courtFacilityName: courtFacility.name,
        courtName: courts.name,
        kind: courtOwnerReviews.kind,
        submittedValues: courtOwnerReviews.submittedValues,
        status: courtOwnerReviews.status,
        rejectionReason: courtOwnerReviews.rejectionReason,
        createdAt: courtOwnerReviews.createdAt,
        reviewedAt: courtOwnerReviews.reviewedAt,
      })
        .from(courtOwnerReviews)
        .leftJoin(reviewFacility, eq(courtOwnerReviews.facilityId, reviewFacility.id))
        .leftJoin(courts, eq(courtOwnerReviews.courtId, courts.id))
        .leftJoin(courtFacility, eq(courts.facilityId, courtFacility.id))
        .where(where)
        .orderBy(desc(courtOwnerReviews.createdAt), desc(courtOwnerReviews.id))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ value: count() })
        .from(courtOwnerReviews)
        .leftJoin(reviewFacility, eq(courtOwnerReviews.facilityId, reviewFacility.id))
        .leftJoin(courts, eq(courtOwnerReviews.courtId, courts.id))
        .leftJoin(courtFacility, eq(courts.facilityId, courtFacility.id))
        .where(where),
    ]);
    return { rows, total: total.value };
  },
  async pendingCount() {
    const [row] = await db.select({ value: count() }).from(courtOwnerReviews).where(eq(courtOwnerReviews.status, 'PENDING'));
    return row.value;
  },
  async lockFacility(id: number, tx: OwnerTransaction) {
    const [row] = await tx.select().from(facilities).where(eq(facilities.id, id)).for('update');
    return row ?? null;
  },
  async court(facilityId: number, id: number, tx: OwnerTransaction) {
    const [row] = await tx.select().from(courts).where(and(eq(courts.id, id), eq(courts.facilityId, facilityId)));
    return row ?? null;
  },
  async lockReview(id: number, tx: OwnerTransaction) {
    const [row] = await tx.select().from(courtOwnerReviews).where(eq(courtOwnerReviews.id, id)).for('update');
    return row ?? null;
  },
  async decide(id: number, adminId: number, approve: boolean, reason: string | undefined, tx: OwnerTransaction) {
    const [row] = await tx.update(courtOwnerReviews).set({ status: approve ? 'APPROVED' : 'REJECTED', reviewedBy: adminId, reviewedAt: new Date(), rejectionReason: approve ? null : reason }).where(eq(courtOwnerReviews.id, id)).returning();
    return row;
  },
  async facilityStatus(id: number, status: string, tx: OwnerTransaction) {
    await tx.update(facilities).set({ status, updatedAt: new Date() }).where(eq(facilities.id, id));
  },
  async courtStatus(id: number, status: string, tx: OwnerTransaction) {
    await tx.update(courts).set({ status, updatedAt: new Date() }).where(eq(courts.id, id));
  },
  async location(id: number, values: { address: string; ward?: string | null; district: string; city: string; latitude: string; longitude: string }, tx: OwnerTransaction) {
    await tx.update(facilities).set({ ...values, ward: values.ward ?? null, updatedAt: new Date() }).where(eq(facilities.id, id));
  },
};
