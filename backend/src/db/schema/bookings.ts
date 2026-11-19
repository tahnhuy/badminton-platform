import { pgTable, bigint, varchar, timestamp, decimal, time, date, integer, check, index, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { courts, courtPricings } from './facilities';
import { tournamentRegistrations } from './tournaments';

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
  bookingCode: varchar('booking_code').notNull().unique(),
  version: integer('version').notNull().default(1),
  expiresAt: timestamp('expires_at'),
  cancellationReason: text('cancellation_reason'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  bookingsCourtDateStartIdx: index('bookings_court_date_start_idx').on(t.courtId, t.bookingDate, t.startTime),
  bookingsPlayerStatusIdx: index('bookings_player_status_idx').on(t.playerId, t.status),
  bookingsCreatedIdx: index('bookings_created_idx').on(t.createdAt),
  bookingsStatusDateIdx: index('bookings_status_date_idx').on(t.status, t.bookingDate),
}));

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
  bookingId: bigint('booking_id', { mode: 'number' }).references(() => bookings.id),
  registrationId: bigint('registration_id', { mode: 'number' }).references(() => tournamentRegistrations.id),
  amount: decimal('amount').notNull(),
  provider: varchar('provider').notNull(),
  paymentMethod: varchar('payment_method').notNull(),
  transactionId: varchar('transaction_id').unique(),
  status: varchar('status').notNull(),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  chkPaymentTarget: check(
    'chk_payment_target',
    sql`(${t.bookingId} IS NOT NULL) <> (${t.registrationId} IS NOT NULL)`,
  ),
  paymentsRegistrationIdIdx: index('payments_registration_id_idx').on(t.registrationId),
  paymentsPaidAtIdx: index('payments_paid_at_idx').on(t.paidAt),
}));

export const paymentRefunds = pgTable('payment_refunds', {
  paymentId: bigint('payment_id', { mode: 'number' }).primaryKey().references(() => payments.id),
  status: varchar('status').notNull(),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  reason: varchar('reason', { length: 200 }),
  claimedAt: timestamp('claimed_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  chkPaymentRefundStatus: check(
    'chk_payment_refund_status',
    sql`${t.status} IN ('PENDING', 'PROCESSING', 'REFUNDED', 'FAILED')`,
  ),
  paymentRefundsStatusIdx: index('payment_refunds_status_idx').on(t.status),
}));
