import { sql } from 'drizzle-orm';
import { pgTable, bigint, text, varchar, timestamp, check, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { facilities } from './facilities';
import { users } from './users';

export const facilityHandovers = pgTable('facility_handovers', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  facilityId: bigint('facility_id', { mode: 'number' }).notNull().references(() => facilities.id),
  ownerId: bigint('owner_id', { mode: 'number' }).notNull().references(() => users.id),
  previousOwnerId: bigint('previous_owner_id', { mode: 'number' }).notNull().references(() => users.id),
  evidence: text('evidence').notNull(),
  status: varchar('status').notNull().default('PENDING'),
  reviewedBy: bigint('reviewed_by', { mode: 'number' }).references(() => users.id),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
  confirmedAt: timestamp('confirmed_at'),
}, t => ({
  status: check('chk_facility_handover_status', sql`${t.status} IN ('PENDING', 'APPROVED', 'REJECTED', 'CONFIRMED')`),
  decision: check('chk_facility_handover_decision', sql`(${t.status} = 'PENDING' AND ${t.reviewedBy} IS NULL AND ${t.reviewedAt} IS NULL AND ${t.confirmedAt} IS NULL) OR (${t.status} IN ('APPROVED', 'REJECTED') AND ${t.reviewedBy} IS NOT NULL AND ${t.reviewedAt} IS NOT NULL AND ${t.confirmedAt} IS NULL AND length(trim(${t.reason})) > 0) OR (${t.status} = 'CONFIRMED' AND ${t.reviewedBy} IS NOT NULL AND ${t.reviewedAt} IS NOT NULL AND ${t.confirmedAt} IS NOT NULL AND length(trim(${t.reason})) > 0)`),
  pending: uniqueIndex('uq_facility_handover_open').on(t.facilityId).where(sql`${t.status} IN ('PENDING', 'APPROVED')`),
  owner: index('facility_handovers_owner_idx').on(t.ownerId, t.id),
}));
