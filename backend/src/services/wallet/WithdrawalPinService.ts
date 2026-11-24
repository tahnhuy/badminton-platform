import { eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { withdrawalPins } from '../../db/schema/auth';
import { AppError } from '../../errors/AppError';
import type { DbExecutor } from '../../repositories/auth/AuthRepository';
import { withdrawalPinHasher } from '../auth/withdrawal-pin-hasher';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATIONS_MINUTES = [15, 60, 24 * 60];

type PinRow = typeof withdrawalPins.$inferSelect;

function lockMinutesFor(lockCount: number): number {
  return LOCK_DURATIONS_MINUTES[Math.min(Math.max(lockCount - 1, 0), LOCK_DURATIONS_MINUTES.length - 1)];
}

function lockedError(lockedUntil: Date): AppError {
  const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
  const error = new AppError('WALLET_PIN_LOCKED', 429, 'Withdrawal PIN is temporarily locked', [
    { lockedUntil: lockedUntil.toISOString() },
  ]);
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

export const withdrawalPinService = {
  async getStatus(userId: number): Promise<{ hasPin: boolean; lockedUntil: string | null }> {
    const [row] = await db
      .select()
      .from(withdrawalPins)
      .where(eq(withdrawalPins.userId, userId))
      .limit(1);

    if (!row) return { hasPin: false, lockedUntil: null };
    const locked = row.lockedUntil && row.lockedUntil > new Date();
    return { hasPin: true, lockedUntil: locked ? row.lockedUntil!.toISOString() : null };
  },

  async hasPin(userId: number, executor: DbExecutor = db): Promise<boolean> {
    const [row] = await executor
      .select({ userId: withdrawalPins.userId })
      .from(withdrawalPins)
      .where(eq(withdrawalPins.userId, userId))
      .limit(1);
    return Boolean(row);
  },

  async setPin(userId: number, pin: string): Promise<void> {
    const pinHash = await withdrawalPinHasher.hash(pin);
    await db
      .insert(withdrawalPins)
      .values({ userId, pinHash })
      .onConflictDoUpdate({
        target: withdrawalPins.userId,
        set: {
          pinHash,
          failedAttempts: 0,
          lockCount: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        },
      });
  },

  /**
   * Verifies the PIN and persists the attempt counter in its own committed
   * transaction. Returns the verified PIN hash as its version so the payout
   * transaction can detect a PIN change between verification and request
   * creation. The hash is salted, so it changes on every PIN set/reset but not
   * on counter updates; `updatedAt` cannot serve as the version because every
   * attempt bumps it, which made parallel valid requests fail spuriously.
   */
  async verifyForPayout(userId: number, pin: string): Promise<{ pinVersion: string }> {
    const [snapshot] = await db
      .select()
      .from(withdrawalPins)
      .where(eq(withdrawalPins.userId, userId))
      .limit(1);

    if (!snapshot) {
      throw new AppError('WALLET_PIN_NOT_SET', 400, 'Withdrawal PIN has not been set');
    }

    const now = new Date();
    if (snapshot.lockedUntil && snapshot.lockedUntil > now) {
      throw lockedError(snapshot.lockedUntil);
    }

    const matches = await withdrawalPinHasher.verify(pin, snapshot.pinHash);

    const outcome = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(withdrawalPins)
        .where(eq(withdrawalPins.userId, userId))
        .for('update')
        .limit(1);

      if (!current) {
        throw new AppError('WALLET_PIN_NOT_SET', 400, 'Withdrawal PIN has not been set');
      }
      if (current.lockedUntil && current.lockedUntil > new Date()) {
        throw lockedError(current.lockedUntil);
      }
      if (current.pinHash !== snapshot.pinHash) {
        // The PIN changed while bcrypt was running; never trust the stale check.
        throw new AppError('WALLET_PIN_INVALID', 400, 'Withdrawal PIN is invalid');
      }

      if (matches) {
        await tx
          .update(withdrawalPins)
          .set({
            failedAttempts: 0,
            lockCount: 0,
            lockedUntil: null,
          })
          .where(eq(withdrawalPins.userId, userId));
        return { verified: true, lockedUntil: null as Date | null };
      }

      const nextFailed = current.failedAttempts + 1;
      if (nextFailed >= MAX_FAILED_ATTEMPTS) {
        const nextLockCount = current.lockCount + 1;
        const lockedUntil = new Date(Date.now() + lockMinutesFor(nextLockCount) * 60_000);
        await tx
          .update(withdrawalPins)
          .set({
            failedAttempts: 0,
            lockCount: nextLockCount,
            lockedUntil,
          })
          .where(eq(withdrawalPins.userId, userId));
        return { verified: false, lockedUntil };
      }

      await tx
        .update(withdrawalPins)
        .set({ failedAttempts: nextFailed })
        .where(eq(withdrawalPins.userId, userId));
      return { verified: false, lockedUntil: null as Date | null };
    });

    if (outcome.lockedUntil) throw lockedError(outcome.lockedUntil);
    if (!outcome.verified) {
      throw new AppError('WALLET_PIN_INVALID', 400, 'Withdrawal PIN is invalid');
    }
    return { pinVersion: snapshot.pinHash };
  },

  /**
   * Inside the payout transaction: the PIN must still be the same version that
   * was verified, otherwise the request is rejected without moving money.
   */
  async assertPinUnchanged(
    userId: number,
    expectedPinVersion: string,
    executor: DbExecutor = db
  ): Promise<void> {
    const [row] = await executor
      .select({ pinHash: withdrawalPins.pinHash })
      .from(withdrawalPins)
      .where(eq(withdrawalPins.userId, userId))
      .for('update')
      .limit(1);
    if (!row || row.pinHash !== expectedPinVersion) {
      throw new AppError('WALLET_PIN_INVALID', 400, 'Withdrawal PIN changed during the request');
    }
  },

  async resetPin(userId: number, pin: string, executor: DbExecutor = db): Promise<void> {
    const pinHash = await withdrawalPinHasher.hash(pin);
    await executor
      .insert(withdrawalPins)
      .values({ userId, pinHash })
      .onConflictDoUpdate({
        target: withdrawalPins.userId,
        set: {
          pinHash,
          failedAttempts: 0,
          lockCount: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        },
      });
  },

  /** Test/dev helper to count failures without exposing them through the API. */
  async debugRow(userId: number): Promise<PinRow | null> {
    const [row] = await db.select().from(withdrawalPins).where(eq(withdrawalPins.userId, userId));
    return row ?? null;
  },
};
