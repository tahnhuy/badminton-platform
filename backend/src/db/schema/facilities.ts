import { sql } from 'drizzle-orm';
import { pgTable, bigint, varchar, text, timestamp, decimal, time, date, index, check, customType } from 'drizzle-orm/pg-core';
import { users } from './users';

const int4range = customType<{ data: string }>({ dataType: () => 'int4range' });
const daterange = customType<{ data: string }>({ dataType: () => 'daterange' });

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
  latitude: decimal('latitude').notNull(),
  longitude: decimal('longitude').notNull(),
  openingTime: time('opening_time').notNull(),
  closingTime: time('closing_time').notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => ({
  statusCheck: check('chk_facility_status', sql`${t.status} IN ('ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'REJECTED')`),
  idxFacilitiesStatusCreated: index('facilities_status_created_idx').on(t.status, t.createdAt),
}));

export const courts = pgTable('courts', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  facilityId: bigint('facility_id', { mode: 'number' }).notNull().references(() => facilities.id),
  name: varchar('name').notNull(),
  status: varchar('status').notNull(),
  description: text('description'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => ({
  statusCheck: check('chk_court_status', sql`${t.status} IN ('ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'REJECTED')`),
  idxCourtsFacilityStatus: index('courts_facility_status_idx').on(t.facilityId, t.status),
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
