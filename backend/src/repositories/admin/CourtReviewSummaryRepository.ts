import { asc, desc, eq } from 'drizzle-orm';
import { db, courts, courtOwnerReviews, courtStandardClaims, courtStandards } from '../../db';

/** Latest submitted review and latest claim per standard, scoped to one facility. */
export async function courtReviewSummaries(facilityId: number) {
  const [reviews, claims] = await Promise.all([
    db.selectDistinctOn([courtOwnerReviews.courtId], {
      courtId: courtOwnerReviews.courtId, id: courtOwnerReviews.id, status: courtOwnerReviews.status,
      submittedAt: courtOwnerReviews.createdAt,
    }).from(courtOwnerReviews).innerJoin(courts, eq(courts.id, courtOwnerReviews.courtId))
      .where(eq(courts.facilityId, facilityId))
      .orderBy(asc(courtOwnerReviews.courtId), desc(courtOwnerReviews.createdAt), desc(courtOwnerReviews.id)),
    db.selectDistinctOn([courtStandardClaims.courtId, courtStandardClaims.standardCode], {
      id: courtStandardClaims.id, courtId: courtStandardClaims.courtId,
      standardCode: courtStandardClaims.standardCode, standardName: courtStandards.name,
      status: courtStandardClaims.status, expiresAt: courtStandardClaims.expiresAt,
    }).from(courtStandardClaims).innerJoin(courts, eq(courts.id, courtStandardClaims.courtId))
      .innerJoin(courtStandards, eq(courtStandards.code, courtStandardClaims.standardCode))
      .where(eq(courts.facilityId, facilityId))
      .orderBy(asc(courtStandardClaims.courtId), asc(courtStandardClaims.standardCode), desc(courtStandardClaims.createdAt), desc(courtStandardClaims.id)),
  ]);
  return { reviews, claims };
}
