import { and, eq, gt, isNull, lte, lt, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  authChallenges,
  authResetTokens,
  pendingRegistrations,
} from '../../db/schema/auth';
import type { OtpPurpose, ResetPurpose } from '../../services/auth/otp';

export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbExecutor = DbClient | DbTransaction;

export interface CreateChallengeInput {
  id: string;
  purpose: OtpPurpose;
  email: string;
  userId?: number | null;
  pendingRegistrationId?: string | null;
  otpDigest: string | null;
  expiresAt: Date;
  resendAvailableAt: Date;
}

export const challengeRepository = {
  async createPendingRegistration(
    input: {
      id: string;
      email: string;
      passwordHash: string;
      pinHash: string;
      fullName: string;
      phone: string | null;
      skillLevelId: number;
      surveySnapshot: Record<string, unknown>;
      expiresAt: Date;
    },
    executor: DbExecutor = db
  ) {
    const [row] = await executor.insert(pendingRegistrations).values(input).returning();
    return row;
  },

  async findPendingRegistration(id: string, executor: DbExecutor = db, lock = false) {
    let query = executor.select().from(pendingRegistrations).where(eq(pendingRegistrations.id, id));
    if (lock) query = query.for('update') as typeof query;
    const [row] = await query.limit(1);
    return row ?? null;
  },

  async deletePendingRegistration(id: string, executor: DbExecutor = db): Promise<void> {
    await executor.delete(pendingRegistrations).where(eq(pendingRegistrations.id, id));
  },

  async deleteChallenge(id: string, executor: DbExecutor = db): Promise<void> {
    await executor.delete(authChallenges).where(eq(authChallenges.id, id));
  },

  async createChallenge(input: CreateChallengeInput, executor: DbExecutor = db) {
    const [row] = await executor
      .insert(authChallenges)
      .values({
        id: input.id,
        purpose: input.purpose,
        email: input.email,
        userId: input.userId ?? null,
        pendingRegistrationId: input.pendingRegistrationId ?? null,
        otpDigest: input.otpDigest,
        expiresAt: input.expiresAt,
        resendAvailableAt: input.resendAvailableAt,
        sendCount: 1,
        sendStatus: input.otpDigest ? 'PENDING_SEND' : 'FAILED',
      })
      .returning();
    return row;
  },

  async findChallenge(id: string, executor: DbExecutor = db, lock = false) {
    let query = executor.select().from(authChallenges).where(eq(authChallenges.id, id));
    if (lock) query = query.for('update') as typeof query;
    const [row] = await query.limit(1);
    return row ?? null;
  },

  /**
   * Atomically claims one resend: only the first request for the current
   * generation within the resend window wins, so parallel retries cannot rotate
   * the code twice or send a mismatch between challenge and email.
   */
  async claimResend(
    id: string,
    expectedGeneration: number,
    // A null digest is a fake challenge (password recovery for an unknown email):
    // it advances the same counters as a real one but never sends mail.
    input: { otpDigest: string | null; resendAvailableAt: Date },
    executor: DbExecutor = db
  ) {
    const now = new Date();
    const [row] = await executor
      .update(authChallenges)
      .set({
        otpDigest: input.otpDigest,
        generation: sql`${authChallenges.generation} + 1`,
        resendAvailableAt: input.resendAvailableAt,
        sendCount: sql`${authChallenges.sendCount} + 1`,
        sendStatus: input.otpDigest ? 'PENDING_SEND' : 'FAILED',
        updatedAt: now,
      })
      .where(
        and(
          eq(authChallenges.id, id),
          eq(authChallenges.generation, expectedGeneration),
          isNull(authChallenges.consumedAt),
          gt(authChallenges.expiresAt, now),
          lte(authChallenges.resendAvailableAt, now)
        )
      )
      .returning();
    return row;
  },

  /** Atomic conditional consume: only the first verifier wins. */
  async consumeChallenge(id: string, generation: number, executor: DbExecutor = db): Promise<boolean> {
    const rows = await executor
      .update(authChallenges)
      .set({ consumedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(authChallenges.id, id),
          eq(authChallenges.generation, generation),
          isNull(authChallenges.consumedAt)
        )
      )
      .returning({ id: authChallenges.id });
    return rows.length > 0;
  },

  /**
   * Reserves one verification attempt atomically BEFORE the code is compared.
   * Counting after the comparison would let a burst of parallel guesses all pass
   * the lock check before any of them is counted. Returns null when the
   * challenge is consumed, locked or out of attempts, so the caller must not
   * compare the code. The attempt that reaches the limit locks the challenge
   * until `lockUntil`.
   */
  async reserveAttempt(
    id: string,
    maxAttempts: number,
    lockUntil: Date,
    executor: DbExecutor = db
  ) {
    const now = new Date();
    const [row] = await executor
      .update(authChallenges)
      .set({
        failedAttempts: sql`${authChallenges.failedAttempts} + 1`,
        lockedUntil: sql`CASE WHEN ${authChallenges.failedAttempts} + 1 >= ${maxAttempts} THEN ${lockUntil} ELSE ${authChallenges.lockedUntil} END`,
        updatedAt: now,
      })
      .where(
        and(
          eq(authChallenges.id, id),
          isNull(authChallenges.consumedAt),
          lt(authChallenges.failedAttempts, maxAttempts),
          or(isNull(authChallenges.lockedUntil), lte(authChallenges.lockedUntil, now))
        )
      )
      .returning();
    return row ?? null;
  },

  async countChallengesForEmailSince(
    email: string,
    purpose: OtpPurpose,
    since: Date,
    executor: DbExecutor = db
  ): Promise<number> {
    const [row] = await executor
      .select({ count: sql<number>`count(*)::int` })
      .from(authChallenges)
      .where(
        and(
          eq(authChallenges.email, email),
          eq(authChallenges.purpose, purpose),
          sql`${authChallenges.createdAt} >= ${since}`
        )
      );
    return Number(row?.count ?? 0);
  },

  async createResetToken(
    input: {
      tokenHash: string;
      userId: number;
      challengeId: string;
      purpose: ResetPurpose;
      expiresAt: Date;
    },
    executor: DbExecutor = db
  ) {
    const [row] = await executor.insert(authResetTokens).values(input).returning();
    return row;
  },

  async findResetTokenByHash(tokenHash: string, executor: DbExecutor = db, lock = false) {
    let query = executor.select().from(authResetTokens).where(eq(authResetTokens.tokenHash, tokenHash));
    if (lock) query = query.for('update') as typeof query;
    const [row] = await query.limit(1);
    return row ?? null;
  },

  async consumeResetToken(id: number, executor: DbExecutor = db): Promise<boolean> {
    const rows = await executor
      .update(authResetTokens)
      .set({ consumedAt: new Date() })
      .where(and(eq(authResetTokens.id, id), isNull(authResetTokens.consumedAt)))
      .returning({ id: authResetTokens.id });
    return rows.length > 0;
  },

  /** Invalidates every other outstanding authorization of the same kind for the user. */
  async consumeOtherResetTokens(
    userId: number,
    purpose: ResetPurpose,
    exceptId: number,
    executor: DbExecutor = db
  ): Promise<void> {
    await executor
      .update(authResetTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(authResetTokens.userId, userId),
          eq(authResetTokens.purpose, purpose),
          isNull(authResetTokens.consumedAt),
          sql`${authResetTokens.id} <> ${exceptId}`
        )
      );
  },

  async consumeAllResetTokens(
    userId: number,
    purpose: ResetPurpose,
    executor: DbExecutor = db
  ): Promise<void> {
    await executor
      .update(authResetTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(authResetTokens.userId, userId),
          eq(authResetTokens.purpose, purpose),
          isNull(authResetTokens.consumedAt)
        )
      );
  },

  async deleteExpired(now = new Date()): Promise<void> {
    await db.execute(sql`
      DELETE FROM auth_reset_tokens
      WHERE expires_at < ${now}
         OR challenge_id IN (SELECT id FROM auth_challenges WHERE expires_at < ${now});
    `);
    await db.execute(sql`
      UPDATE auth_challenges SET pending_registration_id = NULL WHERE expires_at < ${now};
    `);
    await db.execute(sql`DELETE FROM auth_challenges WHERE expires_at < ${now};`);
    await db.execute(sql`DELETE FROM pending_registrations WHERE expires_at < ${now};`);
  },
};
