import { and, eq } from 'drizzle-orm';
import { courtOwnerReviews, facilities, courts } from '../../db';
import { OwnerTransaction } from '../owner/owner-db';
export const facilityReviewRepository = {
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
