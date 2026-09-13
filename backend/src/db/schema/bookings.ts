import { pgTable, bigint, varchar, timestamp, decimal, time, date, integer } from 'drizzle-orm/pg-core';
import { users } from './users';
import { courts, courtPricings } from './facilities';

export const bookings = pgTable('bookings', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  playerId: bigint('player_id', { mode: 'number' }).notNull().references(() => users.id),
  courtId: bigint('court_id', { mode: 'number' }).notNull().references(() => courts.id),
  bookingDate: date('booking_date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  unitPrice: decimal('unit_price').notNull(),
  totalAmount: decimal('total_amount').notNull(),
  status: varchar('status').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const bookingPricingDetails = pgTable('booking_pricing_details', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  bookingId: bigint('booking_id', { mode: 'number' }).notNull().references(() => bookings.id),
  courtPricingId: bigint('court_pricing_id', { mode: 'number' }).notNull().references(() => courtPricings.id),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  price: decimal('price').notNull(),
  amount: decimal('amount').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const payments = pgTable('payments', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  bookingId: bigint('booking_id', { mode: 'number' }).notNull().references(() => bookings.id),
  amount: decimal('amount').notNull(),
  provider: varchar('provider').notNull(),
  paymentMethod: varchar('payment_method').notNull(),
  transactionId: varchar('transaction_id').unique(),
  status: varchar('status').notNull(),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
