import { sql } from 'drizzle-orm';
import { pgTable, bigint, smallint, varchar, timestamp, check, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Court Owner partnership requests (docs/features/court-owner/partnership-request/tech-design.md §6).
 * A visitor asks to become a Court Owner; an Admin contacts them, then creates the account or rejects.
 */
export const ownerPartnershipRequests = pgTable('owner_partnership_requests', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  contactName: varchar('contact_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 254 }).notNull(),
  phone: varchar('phone', { length: 15 }).notNull(),
  facilityName: varchar('facility_name', { length: 150 }).notNull(),
  addressLine: varchar('address_line', { length: 255 }).notNull(),
  district: varchar('district', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  expectedCourts: smallint('expected_courts').notNull(),
  note: varchar('note', { length: 1000 }),
  status: varchar('status').notNull().default('PENDING'),
  adminNote: varchar('admin_note', { length: 2000 }),
  rejectReason: varchar('reject_reason', { length: 500 }),
  processedBy: bigint('processed_by', { mode: 'number' }).references(() => users.id),
  processedAt: timestamp('processed_at'),
  createdUserId: bigint('created_user_id', { mode: 'number' }).references(() => users.id),
  submittedIp: varchar('submitted_ip', { length: 45 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => ({
  status: check('chk_owner_request_status', sql`${t.status} IN ('PENDING', 'CONTACTED', 'APPROVED', 'REJECTED')`),
  courts: check('chk_owner_request_courts', sql`${t.expectedCourts} BETWEEN 1 AND 50`),
  rejected: check('chk_owner_request_rejected', sql`${t.status} <> 'REJECTED' OR (${t.rejectReason} IS NOT NULL AND length(trim(${t.rejectReason})) > 0)`),
  approved: check('chk_owner_request_approved', sql`${t.status} <> 'APPROVED' OR ${t.createdUserId} IS NOT NULL`),
  processed: check('chk_owner_request_processed', sql`${t.status} IN ('PENDING', 'CONTACTED') OR (${t.processedBy} IS NOT NULL AND ${t.processedAt} IS NOT NULL)`),
  // At most one open request per email (PRD §8); also serializes concurrent submits.
  openEmail: uniqueIndex('uq_owner_request_open_email').on(t.email).where(sql`${t.status} IN ('PENDING', 'CONTACTED')`),
  statusCreated: index('owner_requests_status_created_idx').on(t.status, t.createdAt),
}));
