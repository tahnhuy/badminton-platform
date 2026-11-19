import {
  pgTable,
  bigint,
  varchar,
  timestamp,
  decimal,
  boolean,
  check,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

/**
 * D9 wallet ledger (2026-11-15). `balance` includes held funds; available balance is
 * balance minus active HELD rows. Ledger entries are append-only; no update/delete API.
 */
export const walletAccounts = pgTable('wallet_accounts', {
  userId: bigint('user_id', { mode: 'number' }).primaryKey().references(() => users.id),
  balance: decimal('balance', { precision: 14, scale: 2 }).notNull().default('0.00'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  chkWalletBalance: check('chk_wallet_balance', sql`${t.balance} >= 0`),
}));

export const walletLedgerEntries = pgTable('wallet_ledger_entries', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  entryType: varchar('entry_type').notNull(),
  amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 14, scale: 2 }).notNull(),
  referenceType: varchar('reference_type'),
  referenceId: bigint('reference_id', { mode: 'number' }),
  description: varchar('description', { length: 200 }),
  idempotencyKey: varchar('idempotency_key', { length: 120 }),
  createdBy: bigint('created_by', { mode: 'number' }).references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  chkWalletEntryType: check(
    'chk_wallet_entry_type',
    sql`${t.entryType} IN ('TOP_UP', 'PAYMENT', 'REFUND', 'WITHDRAWAL', 'PAYOUT', 'ADMIN_ADJUSTMENT', 'OWNER_EARNING', 'OWNER_EARNING_REVERSAL')`,
  ),
  chkWalletEntryAmount: check('chk_wallet_entry_amount', sql`${t.amount} <> 0`),
  chkWalletEntryBalance: check('chk_wallet_entry_balance', sql`${t.balanceAfter} >= 0`),
  walletEntriesUserCreatedIdx: index('wallet_entries_user_created_idx').on(t.userId, t.createdAt, t.id),
  walletEntriesTypeCreatedIdx: index('wallet_entries_type_created_idx').on(t.entryType, t.createdAt, t.id),
  walletEntriesReferenceIdx: index('wallet_entries_reference_idx').on(t.referenceType, t.referenceId),
  walletEntriesIdempotencyIdx: uniqueIndex('uq_wallet_entries_user_idempotency')
    .on(t.userId, t.idempotencyKey)
    .where(sql`${t.idempotencyKey} IS NOT NULL`),
}));

export const walletHolds = pgTable('wallet_holds', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
  status: varchar('status').notNull(),
  referenceType: varchar('reference_type'),
  referenceId: bigint('reference_id', { mode: 'number' }),
  idempotencyKey: varchar('idempotency_key', { length: 120 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  releasedAt: timestamp('released_at'),
  capturedAt: timestamp('captured_at'),
}, (t) => ({
  chkWalletHoldAmount: check('chk_wallet_hold_amount', sql`${t.amount} > 0`),
  chkWalletHoldStatus: check(
    'chk_wallet_hold_status',
    sql`${t.status} IN ('HELD', 'CAPTURED', 'RELEASED')`,
  ),
  walletHoldsUserStatusIdx: index('wallet_holds_user_status_idx').on(t.userId, t.status),
  walletHoldsIdempotencyIdx: uniqueIndex('uq_wallet_holds_user_idempotency')
    .on(t.userId, t.idempotencyKey)
    .where(sql`${t.idempotencyKey} IS NOT NULL`),
}));

export const walletTopUps = pgTable('wallet_top_ups', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
  status: varchar('status').notNull(),
  provider: varchar('provider').notNull(),
  txnRef: varchar('txn_ref', { length: 120 }).notNull().unique(),
  providerTransactionId: varchar('provider_transaction_id', { length: 120 }),
  idempotencyKey: varchar('idempotency_key', { length: 120 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  paidAt: timestamp('paid_at'),
  expiresAt: timestamp('expires_at'),
}, (t) => ({
  chkWalletTopUpAmount: check('chk_wallet_top_up_amount', sql`${t.amount} > 0`),
  chkWalletTopUpStatus: check(
    'chk_wallet_top_up_status',
    sql`${t.status} IN ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED')`,
  ),
  walletTopUpsUserCreatedIdx: index('wallet_top_ups_user_created_idx').on(t.userId, t.createdAt, t.id),
  walletTopUpsStatusCreatedIdx: index('wallet_top_ups_status_created_idx').on(t.status, t.createdAt, t.id),
  walletTopUpsIdempotencyIdx: uniqueIndex('uq_wallet_top_ups_user_idempotency')
    .on(t.userId, t.idempotencyKey)
    .where(sql`${t.idempotencyKey} IS NOT NULL`),
}));

export const walletBankAccounts = pgTable('wallet_bank_accounts', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  bankCode: varchar('bank_code', { length: 50 }).notNull(),
  accountNumber: varchar('account_number', { length: 50 }).notNull(),
  accountName: varchar('account_name', { length: 120 }).notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  unqWalletBankAccount: uniqueIndex('uq_wallet_bank_accounts_user_account')
    .on(t.userId, t.bankCode, t.accountNumber),
}));

export const walletPayoutRequests = pgTable('wallet_payout_requests', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  requestType: varchar('request_type').notNull(),
  amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
  status: varchar('status').notNull(),
  bankAccountId: bigint('bank_account_id', { mode: 'number' }).notNull().references(() => walletBankAccounts.id),
  holdId: bigint('hold_id', { mode: 'number' }).references(() => walletHolds.id),
  adminId: bigint('admin_id', { mode: 'number' }).references(() => users.id),
  adminNote: varchar('admin_note', { length: 200 }),
  transferReference: varchar('transfer_reference', { length: 120 }),
  requestedAt: timestamp('requested_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  chkWalletPayoutAmount: check('chk_wallet_payout_amount', sql`${t.amount} > 0`),
  chkWalletPayoutType: check(
    'chk_wallet_payout_type',
    sql`${t.requestType} IN ('WITHDRAWAL', 'OWNER_PAYOUT')`,
  ),
  chkWalletPayoutStatus: check(
    'chk_wallet_payout_status',
    sql`${t.status} IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'FAILED')`,
  ),
  walletPayoutUserStatusIdx: index('wallet_payout_user_status_idx').on(t.userId, t.status),
  walletPayoutStatusCreatedIdx: index('wallet_payout_status_created_idx').on(t.status, t.createdAt),
  walletPayoutStatusRequestedIdx: index('wallet_payout_status_requested_idx').on(t.status, t.requestedAt, t.id),
}));
