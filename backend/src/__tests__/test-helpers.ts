import { and, desc, eq } from 'drizzle-orm';
import { PRD_EXAMPLES } from '../services/auth/skill-survey/fixtures';
import { emailOutbox } from '../db/schema/email';
import { db } from '../db';
import { users } from '../db/schema/users';
import { passwordHasher } from '../services/auth/password-hasher';

export interface CreateTestUserOptions {
  email?: string;
  password?: string;
  role?: 'PLAYER' | 'COURT_OWNER' | 'ADMIN';
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  mustChangePassword?: boolean;
  deletedAt?: Date | null;
}

export async function createTestUser(options: CreateTestUserOptions = {}) {
  const email = options.email || `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
  const plainPassword = options.password || 'ValidPassword123!';
  const passwordHash = await passwordHasher.hash(plainPassword);

  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      role: options.role || 'PLAYER',
      status: options.status || 'ACTIVE',
      mustChangePassword: options.mustChangePassword ?? false,
      deletedAt: options.deletedAt || null,
    })
    .returning();

  return {
    ...created,
    plainPassword,
  };
}

/**
 * MM-21 fixtures: every recruitment row needs its MATCH_FINDING post and interval fields.
 * Returns the extra columns to spread into a `matchmakingRequests` insert.
 */
export async function recruitmentFixtureColumns(hostId: number, matchType: 'SINGLES' | 'DOUBLES', startAt: Date, durationMinutes: number) {
  const { posts } = await import('../db/schema/social');
  const [post] = await db.insert(posts).values({ authorId: hostId, type: 'MATCH_FINDING' }).returning({ id: posts.id });
  const slots = matchType === 'SINGLES' ? 2 : 4;
  return { postId: post.id, startAt, durationMinutes, capacity: slots, minPlayers: slots };
}

/**
 * `skillSurvey` body for POST /auth/register (AUTH-30). Defaults to PRD example #1
 * (version 1 → `AVERAGE`), so tests that only need a Player keep the old rank 4.
 */
export function surveyBody(answers: Record<string, string | number | boolean> = PRD_EXAMPLES[1].answers, version = 1) {
  return { version, answers };
}

/** Accepted non-weak 6-digit PIN used by payout tests. */
export const TEST_WITHDRAWAL_PIN = '284691';

export async function ensureWithdrawalPin(userId: number, pin = TEST_WITHDRAWAL_PIN): Promise<void> {
  const { withdrawalPinService } = await import('../services/wallet/WithdrawalPinService');
  await withdrawalPinService.setPin(userId, pin);
}

/** Sends every pending outbox row through the fake adapter (tests only). */
export async function flushEmailOutbox(): Promise<void> {
  const { emailOutboxService } = await import('../services/email/EmailOutboxService');
  await emailOutboxService.processPending(1000);
}

/** Latest OTP from the outbox for an email/template; tests use the DB as source of truth. */
export async function latestOtp(email: string, template: 'REGISTER_OTP' | 'PASSWORD_RESET_OTP' | 'PASSWORD_CHANGE_OTP' | 'WITHDRAWAL_PIN_RESET_OTP'): Promise<string> {
  const [row] = await db
    .select()
    .from(emailOutbox)
    .where(and(eq(emailOutbox.toEmail, email.toLowerCase()), eq(emailOutbox.template, template)))
    .orderBy(desc(emailOutbox.id))
    .limit(1);
  const otp = (row?.payload as { otp?: string } | null)?.otp;
  if (!otp) throw new Error(`No ${template} OTP found for ${email}`);
  return otp;
}

/** Registration payload with valid defaults (including a strong withdrawal PIN). */
export function registerPayload(overrides: Record<string, unknown> = {}) {
  return {
    email: `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: 'ValidPassword123!',
    fullName: 'Nguyen Van A',
    withdrawalPin: '284691',
    withdrawalPinConfirm: '284691',
    skillSurvey: surveyBody(),
    ...overrides,
  };
}
