import { sql } from 'drizzle-orm';
import { pgTable, bigint, varchar, text, boolean, date, timestamp, integer, check, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { courts } from './facilities';
import { users } from './users';
import { mediaFiles } from './media';

export const courtStandards = pgTable('court_standards', {
  code: varchar('code').primaryKey(),
  name: varchar('name').notNull(),
  appliesTo: varchar('applies_to').notNull().default('COURT'),
  requiresExpiry: boolean('requires_expiry').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
}, t => ({
  appliesToCheck: check('chk_court_standard_applies_to', sql`${t.appliesTo} = 'COURT'`),
}));

export const courtStandardClaims = pgTable('court_standard_claims', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  courtId: bigint('court_id', { mode: 'number' }).notNull().references(() => courts.id),
  standardCode: varchar('standard_code').notNull().references(() => courtStandards.code),
  status: varchar('status').notNull(),
  submittedBy: bigint('submitted_by', { mode: 'number' }).notNull().references(() => users.id),
  surfaceBrand: varchar('surface_brand').notNull(),
  surfaceModel: varchar('surface_model').notNull(),
  issuer: varchar('issuer').notNull(),
  referenceNo: varchar('reference_no').notNull(),
  issuedAt: date('issued_at'),
  expiresAt: date('expires_at'),
  reviewedBy: bigint('reviewed_by', { mode: 'number' }).references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => ({
  statusCheck: check('chk_court_standard_claim_status', sql`${t.status} IN ('PENDING', 'VERIFIED', 'REJECTED', 'INVALIDATED')`),
  decision: check('chk_court_standard_claim_decision', sql`(${t.status} = 'PENDING' AND ${t.reviewedBy} IS NULL AND ${t.reviewedAt} IS NULL AND ${t.rejectionReason} IS NULL) OR (${t.status} = 'VERIFIED' AND ${t.reviewedBy} IS NOT NULL AND ${t.reviewedAt} IS NOT NULL AND ${t.rejectionReason} IS NULL) OR (${t.status} = 'REJECTED' AND ${t.reviewedBy} IS NOT NULL AND ${t.reviewedAt} IS NOT NULL AND ${t.rejectionReason} IS NOT NULL AND length(trim(${t.rejectionReason})) > 0) OR (${t.status} = 'INVALIDATED')`),
  activeUnique: uniqueIndex('uq_court_standard_claim_active').on(t.courtId, t.standardCode).where(sql`${t.status} IN ('PENDING', 'VERIFIED')`),
  courtCreated: index('court_standard_claims_court_created_idx').on(t.courtId, t.createdAt),
  statusCreated: index('court_standard_claims_status_created_idx').on(t.status, t.createdAt),
}));

export const courtStandardEvidence = pgTable('court_standard_evidence', {
  claimId: bigint('claim_id', { mode: 'number' }).notNull().references(() => courtStandardClaims.id),
  mediaId: bigint('media_id', { mode: 'number' }).notNull().references(() => mediaFiles.id),
  position: integer('position').notNull(),
}, t => ({
  primaryKey: uniqueIndex('uq_court_standard_evidence').on(t.claimId, t.mediaId),
  positionCheck: check('chk_court_standard_evidence_position', sql`${t.position} > 0`),
  media: index('court_standard_evidence_media_idx').on(t.mediaId),
}));
