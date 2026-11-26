import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../index';
import { users } from '../../schema/users';
import { courts, facilities } from '../../schema/facilities';
import { courtOwnerReviews } from '../../schema/court-owner';
import { ownerFacilityService } from '../../../services/owner/OwnerFacilityService';
import { ownerCourtService } from '../../../services/owner/OwnerCourtService';
import { ownerCourtProfileService } from '../../../services/owner/OwnerCourtProfileService';
import { ownerPricingService } from '../../../services/owner/OwnerPricingService';
import { facilityReviewService } from '../../../services/admin/FacilityReviewService';
import { DEMO_FACILITIES, type DemoFacility } from '../data/facilities';
import { seedGooglePlacesFacilities } from '../lib/google-places';
import { stampAt } from '../lib/stamp';
import type { SeedContext, SeedFacility } from '../context';

/**
 * Demo venues go through the real owner/admin flow: owner submits facility + courts, Admin
 * reviews, owner sets court profiles and prices. 54 real venues come from Google Places.
 */
export async function seedFacilities(ctx: SeedContext): Promise<void> {
  for (const spec of DEMO_FACILITIES) ctx.facilities.push(await seedFacility(ctx, spec));

  const importedAt = ctx.clock.at(-155, '09:00');
  const report = await seedGooglePlacesFacilities({ ownerPasswordHash: ctx.passwordHash });
  await db.update(facilities).set({ createdAt: importedAt, updatedAt: importedAt }).where(eq(facilities.dataSource, 'GOOGLE_PLACES_IMPORT'));
  await db.execute(sql`UPDATE courts SET created_at = ${importedAt}, updated_at = ${importedAt} WHERE data_source = 'GOOGLE_PLACES_IMPORT'`);
  await db.execute(sql`UPDATE court_pricings p SET created_at = ${importedAt}, updated_at = ${importedAt} FROM courts c WHERE c.id = p.court_id AND c.data_source = 'GOOGLE_PLACES_IMPORT'`);
  await db.update(users).set({ createdAt: importedAt, updatedAt: importedAt, emailVerifiedAt: importedAt }).where(eq(users.email, 'imported.venues@smashpro.vn'));
  if (report.invalid.length > 0) ctx.log(`  ! Google Places: bỏ qua ${report.invalid.length} địa điểm không hợp lệ`);
  ctx.log(`Sân: ${DEMO_FACILITIES.length} cơ sở demo, ${report.imported} cơ sở Google Places`);
}

async function seedFacility(ctx: SeedContext, spec: DemoFacility): Promise<SeedFacility> {
  const ownerId = ctx.owners.get(spec.ownerKey);
  if (!ownerId) throw new Error(`Unknown owner ${spec.ownerKey}`);
  const submittedAt = ctx.clock.at(-spec.createdDaysAgo, '10:00');
  const reviewedAt = ctx.clock.at(-spec.createdDaysAgo + 1, '15:00');
  const setupAt = ctx.clock.at(-spec.createdDaysAgo + 1, '17:00');

  const facility = await stampAt(submittedAt, () => ownerFacilityService.create(ownerId, {
    name: spec.name, description: spec.description, phone: spec.phone,
    address: spec.address, ward: spec.ward, district: spec.district, city: spec.city,
    openingTime: spec.openingTime, closingTime: spec.closingTime,
  }));
  const courtRows: Array<{ spec: DemoFacility['courts'][number]; row: { id: number } }> = [];
  for (const court of spec.courts) {
    courtRows.push({ spec: court, row: await stampAt(submittedAt, () => ownerCourtService.create(ownerId, facility.id, { name: court.name })) });
  }

  if (spec.review !== 'PENDING') {
    const approve = spec.review === 'APPROVED';
    await stampAt(reviewedAt, async () => {
      const reviewId = await pendingReview({ facilityId: facility.id });
      await facilityReviewService.decide(ctx.adminId, facility.id, reviewId, approve, 'ONBOARDING', spec.rejectionReason);
      for (const { row } of courtRows) {
        const courtReviewId = await pendingReview({ courtId: row.id });
        await facilityReviewService.decide(ctx.adminId, facility.id, courtReviewId, approve, 'ONBOARDING', spec.rejectionReason, row.id);
      }
    });
    // decide() UPDATES the existing review/facility/court rows with now(): move them to the review time.
    await db.update(courtOwnerReviews).set({ reviewedAt })
      .where(sql`${courtOwnerReviews.facilityId} = ${facility.id} OR ${courtOwnerReviews.courtId} IN ${courtRows.length ? sql`(${sql.join(courtRows.map(c => sql`${c.row.id}`), sql`, `)})` : sql`(NULL)`}`);
    await db.update(facilities).set({ updatedAt: reviewedAt }).where(eq(facilities.id, facility.id));
    if (courtRows.length) await db.update(courts).set({ updatedAt: reviewedAt }).where(inArray(courts.id, courtRows.map(c => c.row.id)));
  }

  if (spec.review === 'APPROVED') {
    await stampAt(setupAt, async () => {
      for (const { spec: court, row } of courtRows) {
        await ownerCourtProfileService.update(ownerId, row.id, {
          profileVersion: 0,
          surfaceType: court.surfaceType,
          ...(court.surfaceBrand ? { surfaceBrand: court.surfaceBrand } : {}),
          ...(court.surfaceThicknessMm !== undefined ? { surfaceThicknessMm: court.surfaceThicknessMm } : {}),
          condition: court.condition ?? 'NORMAL',
          ...(court.conditionNote ? { conditionNote: court.conditionNote } : {}),
        });
        for (const price of spec.prices) {
          await ownerPricingService.save(ownerId, row.id, {
            startTime: price.start, endTime: price.end, pricePerHour: price.price, validFrom: ctx.clock.date(-spec.createdDaysAgo), validTo: null,
          });
        }
      }
    });
    if (courtRows.length) await db.update(courts).set({ updatedAt: setupAt }).where(inArray(courts.id, courtRows.map(c => c.row.id)));
  } else if (spec.review === 'PENDING') {
    // Prices are part of a complete submission; the owner can set them before approval.
    await stampAt(submittedAt, async () => {
      for (const { row } of courtRows) for (const price of spec.prices) {
        await ownerPricingService.save(ownerId, row.id, { startTime: price.start, endTime: price.end, pricePerHour: price.price, validFrom: ctx.clock.date(-spec.createdDaysAgo), validTo: null });
      }
    });
  }

  const [stored] = await db.select({ status: facilities.status }).from(facilities).where(eq(facilities.id, facility.id));
  const expected = spec.review === 'APPROVED' ? 'ACTIVE' : spec.review === 'PENDING' ? 'PENDING_APPROVAL' : 'REJECTED';
  if (stored.status !== expected) throw new Error(`${spec.name}: status ${stored.status}, expected ${expected}`);
  const bookable = courtRows.filter(c => (c.spec.condition ?? 'NORMAL') !== 'UNDER_MAINTENANCE').map(c => c.row.id);
  return {
    id: facility.id, name: spec.name, ownerId, status: expected,
    openingTime: spec.openingTime, closingTime: spec.closingTime,
    courtIds: expected === 'ACTIVE' ? bookable : [], allCourtIds: courtRows.map(c => c.row.id),
  };
}

async function pendingReview(target: { facilityId: number } | { courtId: number }): Promise<number> {
  const condition = 'facilityId' in target ? eq(courtOwnerReviews.facilityId, target.facilityId) : eq(courtOwnerReviews.courtId, target.courtId);
  const [review] = await db.select({ id: courtOwnerReviews.id }).from(courtOwnerReviews)
    .where(and(condition, eq(courtOwnerReviews.status, 'PENDING'), eq(courtOwnerReviews.kind, 'ONBOARDING')));
  if (!review) throw new Error(`No pending onboarding review for ${JSON.stringify(target)}`);
  return review.id;
}
