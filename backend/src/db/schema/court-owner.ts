import { sql } from 'drizzle-orm';
import { pgTable, bigint, date, time, text, varchar, timestamp, jsonb, check, index, uniqueIndex, customType } from 'drizzle-orm/pg-core';
import { courts, facilities } from './facilities';
import { users } from './users';

const tsrange = customType<{ data: string }>({ dataType: () => 'tsrange' });
export const courtSlotBlocks = pgTable('court_slot_blocks', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  courtId: bigint('court_id', { mode: 'number' }).notNull().references(() => courts.id),
  bookingDate: date('booking_date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  blockRange: tsrange('block_range').generatedAlwaysAs(sql`tsrange(booking_date + start_time, booking_date + end_time, '[)')`),
  reason: text('reason').notNull(),
  status: varchar('status').notNull(),
  createdBy: bigint('created_by', { mode: 'number' }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => ({
  range: check('chk_court_slot_block_range', sql`${t.endTime} > ${t.startTime}`),
  status: check('chk_court_slot_block_status', sql`${t.status} IN ('ACTIVE', 'RELEASED')`),
  reason: check('chk_court_slot_block_reason', sql`length(trim(${t.reason})) > 0`),
  courtDate: index('court_slot_blocks_court_date_idx').on(t.courtId, t.bookingDate),
}));

export const courtOwnerReviews = pgTable('court_owner_reviews', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  facilityId: bigint('facility_id', { mode: 'number' }).references(() => facilities.id),
  courtId: bigint('court_id', { mode: 'number' }).references(() => courts.id),
  kind: varchar('kind').notNull(),
  submittedValues: jsonb('submitted_values').$type<Record<string, unknown>>().notNull(),
  status: varchar('status').notNull(),
  submittedBy: bigint('submitted_by', { mode: 'number' }).notNull().references(() => users.id),
  reviewedBy: bigint('reviewed_by', { mode: 'number' }).references(() => users.id),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
}, t => ({
  target: check('chk_owner_review_target', sql`(${t.facilityId} IS NOT NULL) <> (${t.courtId} IS NOT NULL)`),
  kind: check('chk_owner_review_kind', sql`${t.kind} IN ('ONBOARDING', 'ADDRESS_CHANGE') AND (${t.kind} <> 'ADDRESS_CHANGE' OR ${t.facilityId} IS NOT NULL)`),
  status: check('chk_owner_review_status', sql`${t.status} IN ('PENDING', 'APPROVED', 'REJECTED')`),
  decision: check('chk_owner_review_decision', sql`(${t.status} = 'PENDING' AND ${t.reviewedBy} IS NULL AND ${t.reviewedAt} IS NULL AND ${t.rejectionReason} IS NULL) OR (${t.status} = 'APPROVED' AND ${t.reviewedBy} IS NOT NULL AND ${t.reviewedAt} IS NOT NULL AND ${t.rejectionReason} IS NULL) OR (${t.status} = 'REJECTED' AND ${t.reviewedBy} IS NOT NULL AND ${t.reviewedAt} IS NOT NULL AND ${t.rejectionReason} IS NOT NULL AND length(trim(${t.rejectionReason})) > 0)`),
  pendingFacility: uniqueIndex('uq_owner_review_pending_facility').on(t.facilityId, t.kind).where(sql`${t.status} = 'PENDING'`),
  pendingCourt: uniqueIndex('uq_owner_review_pending_court').on(t.courtId, t.kind).where(sql`${t.status} = 'PENDING'`),
  facilityHistory: index('owner_reviews_facility_created_idx').on(t.facilityId, t.createdAt),
  courtHistory: index('owner_reviews_court_created_idx').on(t.courtId, t.createdAt),
}));
