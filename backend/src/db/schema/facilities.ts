import { sql } from 'drizzle-orm';
import { pgTable, bigint, integer, varchar, text, timestamp, decimal, time, date, jsonb, index, check, customType } from 'drizzle-orm/pg-core';
import { users } from './users';

const int4range = customType<{ data: string }>({ dataType: () => 'int4range' });
const daterange = customType<{ data: string }>({ dataType: () => 'daterange' });

export const DATA_SOURCES = ['OWNER_DECLARED', 'ADMIN_ENTERED', 'GOOGLE_PLACES_IMPORT', 'DEMO_SEED'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const facilities = pgTable('facilities', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  ownerId: bigint('owner_id', { mode: 'number' }).notNull().references(() => users.id),
  name: varchar('name').notNull(),
  description: text('description'),
  phone: varchar('phone').notNull(),
  status: varchar('status').notNull(),
  address: varchar('address').notNull(),
  ward: varchar('ward'),
  district: varchar('district').notNull(),
  city: varchar('city').notNull(),
  openingTime: time('opening_time').notNull(),
  closingTime: time('closing_time').notNull(),
  dataSource: varchar('data_source'),
  sourceRef: varchar('source_ref'),
  confirmedAt: timestamp('confirmed_at'),
  confirmedBy: bigint('confirmed_by', { mode: 'number' }).references(() => users.id),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => ({
  statusCheck: check('chk_facility_status', sql`${t.status} IN ('ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'REJECTED')`),
  dataSourceCheck: check('chk_facility_data_source', sql`${t.dataSource} IS NULL OR ${t.dataSource} IN ('OWNER_DECLARED', 'ADMIN_ENTERED', 'GOOGLE_PLACES_IMPORT', 'DEMO_SEED')`),
  idxFacilitiesStatusCreated: index('facilities_status_created_idx').on(t.status, t.createdAt),
}));

export const SURFACE_TYPES = ['PVC', 'WOOD', 'PU_ACRYLIC', 'OTHER'] as const;
export const COURT_CONDITIONS = ['NORMAL', 'NEEDS_MAINTENANCE', 'UNDER_MAINTENANCE'] as const;

export const courts = pgTable('courts', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  facilityId: bigint('facility_id', { mode: 'number' }).notNull().references(() => facilities.id),
  name: varchar('name').notNull(),
  status: varchar('status').notNull(),
  description: text('description'),
  surfaceType: varchar('surface_type'),
  surfaceBrand: varchar('surface_brand'),
  surfaceModel: varchar('surface_model'),
  surfaceThicknessMm: decimal('surface_thickness_mm', { precision: 4, scale: 1 }),
  condition: varchar('condition'),
  conditionNote: text('condition_note'),
  profileVersion: integer('profile_version').notNull().default(0),
  dataSource: varchar('data_source'),
  sourceRef: varchar('source_ref'),
  confirmedAt: timestamp('confirmed_at'),
  confirmedBy: bigint('confirmed_by', { mode: 'number' }).references(() => users.id),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => ({
  statusCheck: check('chk_court_status', sql`${t.status} IN ('ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'REJECTED')`),
  dataSourceCheck: check('chk_court_data_source', sql`${t.dataSource} IS NULL OR ${t.dataSource} IN ('OWNER_DECLARED', 'ADMIN_ENTERED', 'GOOGLE_PLACES_IMPORT', 'DEMO_SEED')`),
  surfaceTypeCheck: check('chk_court_surface_type', sql`${t.surfaceType} IS NULL OR ${t.surfaceType} IN ('PVC', 'WOOD', 'PU_ACRYLIC', 'OTHER')`),
  surfaceThicknessCheck: check('chk_court_surface_thickness', sql`${t.surfaceThicknessMm} IS NULL OR (${t.surfaceThicknessMm} > 0 AND ${t.surfaceThicknessMm} <= 50)`),
  conditionCheck: check('chk_court_condition', sql`${t.condition} IS NULL OR ${t.condition} IN ('NORMAL', 'NEEDS_MAINTENANCE', 'UNDER_MAINTENANCE')`),
  conditionNoteCheck: check('chk_court_condition_note', sql`${t.condition} IS NULL OR ${t.condition} = 'NORMAL' OR (${t.conditionNote} IS NOT NULL AND length(trim(${t.conditionNote})) > 0)`),
  profileVersionCheck: check('chk_court_profile_version', sql`${t.profileVersion} >= 0`),
  idxCourtsFacilityStatus: index('courts_facility_status_idx').on(t.facilityId, t.status),
  idxCourtsCondition: index('courts_condition_idx').on(t.condition),
}));

export const courtProfileChanges = pgTable('court_profile_changes', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  courtId: bigint('court_id', { mode: 'number' }).notNull().references(() => courts.id),
  actorId: bigint('actor_id', { mode: 'number' }).notNull().references(() => users.id),
  changeType: varchar('change_type').notNull(),
  beforeValues: jsonb('before_values').$type<Record<string, unknown>>().notNull(),
  afterValues: jsonb('after_values').$type<Record<string, unknown>>().notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => ({
  changeTypeCheck: check('chk_court_profile_change_type', sql`${t.changeType} IN ('PROFILE', 'CONDITION')`),
  courtCreated: index('court_profile_changes_court_created_idx').on(t.courtId, t.createdAt),
}));

export const facilityStatusAudits = pgTable('facility_status_audits', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  facilityId: bigint('facility_id', { mode: 'number' }).notNull().references(() => facilities.id),
  actorId: bigint('actor_id', { mode: 'number' }).notNull().references(() => users.id),
  fromStatus: varchar('from_status').notNull(),
  toStatus: varchar('to_status').notNull(),
  reasonCode: varchar('reason_code'),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => ({
  facilityCreated: index('facility_status_audits_facility_created_idx').on(t.facilityId, t.createdAt),
}));

export const courtPricings = pgTable('court_pricings', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  courtId: bigint('court_id', { mode: 'number' }).notNull().references(() => courts.id),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  price: decimal('price').notNull(),
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to'),
  pricingTimeRange: int4range('pricing_time_range').generatedAlwaysAs(sql`int4range(extract(epoch from start_time)::integer, extract(epoch from end_time)::integer, '[)')`),
  validityRange: daterange('validity_range').generatedAlwaysAs(sql`daterange(valid_from, valid_to, '[]')`),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  timeCheck: check('chk_court_pricing_time', sql`${t.endTime} > ${t.startTime}`),
  validityCheck: check('chk_court_pricing_validity', sql`${t.validTo} IS NULL OR ${t.validTo} >= ${t.validFrom}`),
  courtPricingsCourtValidIdx: index('court_pricings_court_valid_idx').on(t.courtId, t.validFrom, t.validTo),
}));
