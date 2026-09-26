import { pgTable, bigint, varchar, text, timestamp, decimal, time, date, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const facilities = pgTable('facilities', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  ownerId: bigint('owner_id', { mode: 'number' }).notNull().references(() => users.id),
  name: varchar('name').notNull(),
  description: text('description'),
  phone: varchar('phone').notNull(),
  status: varchar('status').notNull(),
  address: varchar('address').notNull(),
  ward: varchar('ward').notNull(),
  district: varchar('district').notNull(),
  city: varchar('city').notNull(),
  latitude: decimal('latitude').notNull(),
  longitude: decimal('longitude').notNull(),
  openingTime: time('opening_time').notNull(),
  closingTime: time('closing_time').notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const courts = pgTable('courts', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  facilityId: bigint('facility_id', { mode: 'number' }).notNull().references(() => facilities.id),
  name: varchar('name').notNull(),
  status: varchar('status').notNull(),
  description: text('description'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const courtPricings = pgTable('court_pricings', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  courtId: bigint('court_id', { mode: 'number' }).notNull().references(() => courts.id),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  price: decimal('price').notNull(),
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  courtPricingsCourtValidIdx: index('court_pricings_court_valid_idx').on(t.courtId, t.validFrom, t.validTo),
}));
