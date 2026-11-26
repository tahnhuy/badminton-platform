import {
  pgTable,
  bigint,
  varchar,
  timestamp,
  integer,
  index,
  check,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users, skillLevels } from './users';

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
    tokenHash: varchar('token_hash').notNull().unique(),
    idleTimeoutMinutes: integer('idle_timeout_minutes').notNull(),
    lastSeenAt: timestamp('last_seen_at').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('auth_sessions_user_id_idx').on(table.userId),
    check('auth_sessions_idle_timeout_check', sql`${table.idleTimeoutMinutes} > 0`),
  ]
);

/**
 * Temporary registration data (email OTP plan §4). The password and withdrawal
 * PIN are stored already hashed; no user or session exists until the OTP is verified.
 * Multiple rows per email are allowed (§3.1).
 */
export const pendingRegistrations = pgTable(
  'pending_registrations',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    email: varchar('email').notNull(),
    passwordHash: varchar('password_hash').notNull(),
    pinHash: varchar('pin_hash').notNull(),
    fullName: varchar('full_name').notNull(),
    phone: varchar('phone', { length: 20 }),
    skillLevelId: bigint('skill_level_id', { mode: 'number' })
      .notNull()
      .references(() => skillLevels.id),
    /** Answers, computed scores and the serializable survey result at request time. */
    surveySnapshot: jsonb('survey_snapshot').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('pending_registrations_email_idx').on(table.email),
    index('pending_registrations_expires_idx').on(table.expiresAt),
  ]
);

/**
 * One-time email OTP challenge. A fake challenge (password recovery for an
 * unknown/ineligible email) has no `otpDigest` and can never be verified.
 */
export const authChallenges = pgTable(
  'auth_challenges',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    purpose: varchar('purpose').notNull(),
    userId: bigint('user_id', { mode: 'number' }).references(() => users.id),
    pendingRegistrationId: varchar('pending_registration_id', { length: 64 }).references(
      () => pendingRegistrations.id,
      { onDelete: 'set null' }
    ),
    email: varchar('email').notNull(),
    otpDigest: varchar('otp_digest', { length: 128 }),
    generation: integer('generation').notNull().default(1),
    sendCount: integer('send_count').notNull().default(0),
    expiresAt: timestamp('expires_at').notNull(),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until'),
    resendAvailableAt: timestamp('resend_available_at').notNull(),
    consumedAt: timestamp('consumed_at'),
    sendStatus: varchar('send_status').notNull().default('PENDING_SEND'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    check(
      'chk_auth_challenges_purpose',
      sql`${table.purpose} IN ('REGISTER', 'PASSWORD_RESET', 'PASSWORD_CHANGE', 'WITHDRAWAL_PIN_RESET')`
    ),
    check(
      'chk_auth_challenges_send_status',
      sql`${table.sendStatus} IN ('PENDING_SEND', 'SENT', 'FAILED')`
    ),
    check('chk_auth_challenges_failed_attempts', sql`${table.failedAttempts} >= 0`),
    check('chk_auth_challenges_send_count', sql`${table.sendCount} >= 0`),
    index('auth_challenges_email_purpose_created_idx').on(
      table.email,
      table.purpose,
      table.createdAt
    ),
    index('auth_challenges_expires_idx').on(table.expiresAt),
  ]
);

/** Short-lived, single-use reset authorization; only the SHA-256 hash is stored. */
export const authResetTokens = pgTable(
  'auth_reset_tokens',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
    userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
    challengeId: varchar('challenge_id', { length: 64 })
      .notNull()
      .references(() => authChallenges.id),
    purpose: varchar('purpose').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    consumedAt: timestamp('consumed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    check(
      'chk_auth_reset_tokens_purpose',
      sql`${table.purpose} IN ('PASSWORD_RESET', 'PASSWORD_CHANGE', 'WITHDRAWAL_PIN_RESET')`
    ),
    index('auth_reset_tokens_user_purpose_idx').on(table.userId, table.purpose),
    index('auth_reset_tokens_expires_idx').on(table.expiresAt),
  ]
);

/**
 * Reusable 6-digit withdrawal PIN. It is a PIN, not an email OTP: it only
 * authorizes payout requests and is hashed with a dedicated pepper.
 */
export const withdrawalPins = pgTable(
  'withdrawal_pins',
  {
    userId: bigint('user_id', { mode: 'number' }).primaryKey().references(() => users.id),
    pinHash: varchar('pin_hash').notNull(),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockCount: integer('lock_count').notNull().default(0),
    lockedUntil: timestamp('locked_until'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    check('chk_withdrawal_pins_failed_attempts', sql`${table.failedAttempts} >= 0`),
    check('chk_withdrawal_pins_lock_count', sql`${table.lockCount} >= 0`),
  ]
);

export const authLoginLockouts = pgTable(
  'auth_login_lockouts',
  {
    userId: bigint('user_id', { mode: 'number' }).primaryKey().references(() => users.id),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    check('auth_login_lockouts_failed_attempts_check', sql`${table.failedAttempts} >= 0`),
  ]
);
