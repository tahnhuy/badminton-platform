import { pgTable, bigint, varchar, timestamp, integer, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

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
