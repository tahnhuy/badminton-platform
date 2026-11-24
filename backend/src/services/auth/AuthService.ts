import { AppError } from '../../errors/AppError';
import { logger } from '../../shared/logging/logger';
import { systemConfig, SystemRole } from '../../shared/config/system-config';
import { env } from '../../shared/config/env';
import { db } from '../../db';
import { authRepository } from '../../repositories/auth/AuthRepository';
import { challengeRepository } from '../../repositories/auth/ChallengeRepository';
import {
  challengeIdSchema,
  challengeOtpSchema,
  forgotPasswordSchema,
  isPasswordPolicySatisfied,
  mapZodIssuesToDetails,
  rejectOldRegistrationForm,
  rejectOutdatedSurveyVersion,
  validateRegisterInput,
  validateResetPasswordInput,
} from '../../validation/auth';
import { skillSurveyService } from './SkillSurveyService';
import { skillSurveyRepository } from '../../repositories/auth/SkillSurveyRepository';
import { scoreSkillSurvey, toSkillSurveyResult, type SkillSurveyResult } from './skill-survey';
import { passwordHasher } from './password-hasher';
import { isWithdrawalPinAcceptable, withdrawalPinHasher } from './withdrawal-pin-hasher';
import { emailOutboxService } from '../email/EmailOutboxService';
import { withdrawalPinService } from '../wallet/WithdrawalPinService';
import {
  computeOtpDigest,
  generateChallengeId,
  generateOtp,
  generateResetToken,
  hashResetToken,
  otpDigestMatches,
  type OtpPurpose,
} from './otp';

export interface LoginDto {
  email: string;
  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  /** Required for a voluntary change; omitted for the forced first sign-in change. */
  resetToken?: string;
}

export interface CreateCourtOwnerDto {
  email: string;
  initialPassword: string;
  businessName: string;
  phone: string;
}

type ChallengeRecord = NonNullable<Awaited<ReturnType<typeof challengeRepository.findChallenge>>>;

function otpInvalid(): AppError {
  return new AppError('AUTH_OTP_INVALID', 400, 'Verification code is invalid');
}

function otpExpired(): AppError {
  return new AppError('AUTH_OTP_EXPIRED', 400, 'Verification code has expired');
}

function otpLocked(lockedUntil: Date): AppError {
  const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
  const error = new AppError('AUTH_OTP_LOCKED', 429, 'Too many incorrect verification attempts', [
    { lockedUntil: lockedUntil.toISOString() },
  ]);
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

function tooSoon(resendAvailableAt: Date): AppError {
  const retryAfterSeconds = Math.max(1, Math.ceil((resendAvailableAt.getTime() - Date.now()) / 1000));
  const error = new AppError('AUTH_OTP_RESEND_TOO_SOON', 429, 'Please wait before requesting another code', [
    { resendAvailableAt: resendAvailableAt.toISOString() },
  ]);
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

function rateLimited(): AppError {
  return new AppError('AUTH_RATE_LIMITED', 429, 'Too many verification code requests');
}

function challengeResponse(challenge: ChallengeRecord) {
  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
    resendAvailableAt: challenge.resendAvailableAt,
  };
}

async function requireChallenge(
  challengeId: string,
  purpose: OtpPurpose,
  userId?: number
): Promise<ChallengeRecord> {
  const challenge = await challengeRepository.findChallenge(challengeId);
  if (!challenge || challenge.purpose !== purpose) throw otpInvalid();
  if (userId !== undefined && challenge.userId !== userId) throw otpInvalid();
  if (challenge.consumedAt) throw otpInvalid();
  if (challenge.lockedUntil && challenge.lockedUntil > new Date()) throw otpLocked(challenge.lockedUntil);
  if (challenge.expiresAt <= new Date()) throw otpExpired();
  return challenge;
}

async function checkChallengeOtp(challenge: ChallengeRecord, otp: string, maxAttempts: number): Promise<void> {
  // Reserve the attempt first so parallel guesses cannot exceed the limit. A fake
  // challenge (no digest) is counted and locked exactly like a real one, otherwise
  // its missing lockout would reveal that the email has no account.
  const reserved = await challengeRepository.reserveAttempt(
    challenge.id,
    maxAttempts,
    challenge.expiresAt
  );
  if (!reserved) {
    const latest = await challengeRepository.findChallenge(challenge.id);
    if (latest?.lockedUntil && latest.lockedUntil > new Date()) throw otpLocked(latest.lockedUntil);
    throw otpInvalid();
  }

  if (challenge.otpDigest) {
    const digest = computeOtpDigest({
      challengeId: challenge.id,
      purpose: challenge.purpose as OtpPurpose,
      generation: challenge.generation,
      otp,
    });
    if (otpDigestMatches(challenge.otpDigest, digest)) return;
  }

  if (reserved.lockedUntil && reserved.lockedUntil > new Date()) {
    throw otpLocked(reserved.lockedUntil);
  }
  throw otpInvalid();
}

async function underSendLimit(email: string, purpose: OtpPurpose, maxSendsPerHour: number): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await challengeRepository.countChallengesForEmailSince(email, purpose, since);
  return count < maxSendsPerHour;
}

const TEMPLATE_BY_PURPOSE = {
  REGISTER: 'REGISTER_OTP',
  PASSWORD_RESET: 'PASSWORD_RESET_OTP',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE_OTP',
  WITHDRAWAL_PIN_RESET: 'WITHDRAWAL_PIN_RESET_OTP',
} as const;

async function resendChallenge(
  challenge: ChallengeRecord,
  config: { resendSeconds: number; maxSendsPerHour: number; ttlMinutes: number }
): Promise<ReturnType<typeof challengeResponse>> {
  const now = new Date();
  if (challenge.consumedAt) throw otpInvalid();
  if (challenge.expiresAt <= now) throw otpExpired();
  if (challenge.resendAvailableAt > now) throw tooSoon(challenge.resendAvailableAt);
  if (challenge.sendCount >= config.maxSendsPerHour) throw rateLimited();

  // A fake challenge (no digest) goes through the same claim so its resend window
  // and response match a real one, but no mail is queued for it.
  const otp = challenge.otpDigest ? generateOtp() : null;
  const resendAvailableAt = new Date(now.getTime() + config.resendSeconds * 1000);
  const updated = await challengeRepository.claimResend(
    challenge.id,
    challenge.generation,
    {
      otpDigest: otp
        ? computeOtpDigest({
            challengeId: challenge.id,
            purpose: challenge.purpose as OtpPurpose,
            generation: challenge.generation + 1,
            otp,
          })
        : null,
      resendAvailableAt,
    }
  );
  if (!updated) {
    const latest = await challengeRepository.findChallenge(challenge.id);
    if (latest?.resendAvailableAt && latest.resendAvailableAt > now) throw tooSoon(latest.resendAvailableAt);
    throw otpInvalid();
  }

  if (otp) {
    await emailOutboxService.enqueue(db, {
      to: challenge.email,
      template: TEMPLATE_BY_PURPOSE[challenge.purpose as OtpPurpose],
      data: {
        otp,
        expiresInMinutes: config.ttlMinutes,
        challengeId: challenge.id,
      },
      idempotencyKey: `otp:${challenge.id}:${updated.generation}`,
    });
    emailOutboxService.processSoon();
  }

  return challengeResponse(updated);
}

function parseChallengeOtp(body: unknown): { challengeId: string; otp: string } {
  const result = challengeOtpSchema.safeParse(body);
  if (!result.success) {
    const { topLevelCode, details } = mapZodIssuesToDetails(result.error.issues);
    throw new AppError(topLevelCode, 400, 'Validation failed', details);
  }
  return result.data;
}

function parseChallengeId(body: unknown): { challengeId: string } {
  const result = challengeIdSchema.safeParse(body);
  if (!result.success) {
    const { topLevelCode, details } = mapZodIssuesToDetails(result.error.issues);
    throw new AppError(topLevelCode, 400, 'Validation failed', details);
  }
  return result.data;
}

function parseForgotPassword(body: unknown): { email: string } {
  const result = forgotPasswordSchema.safeParse(body);
  if (!result.success) {
    const { topLevelCode, details } = mapZodIssuesToDetails(result.error.issues);
    throw new AppError(topLevelCode, 400, 'Validation failed', details);
  }
  return result.data;
}

export const authService = {
  /**
   * Starts a Player registration: validates the survey and PIN, stores a
   * temporary registration and sends an email OTP. No user or session exists yet.
   * An email that already belongs to an account returns 409 without sending mail.
   */
  async register(body: unknown) {
    rejectOldRegistrationForm(body);
    const survey = await skillSurveyService.requireActiveVersion();
    rejectOutdatedSurveyVersion(body, survey.version);
    const input = validateRegisterInput(body, survey.definition);
    const normalizedEmail = input.email.trim().toLowerCase();

    const existingUser = await authRepository.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError('AUTH_EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');
    }

    if (!isWithdrawalPinAcceptable(input.withdrawalPin)) {
      throw new AppError('WALLET_PIN_WEAK', 400, 'Withdrawal PIN is too weak', [
        { field: 'withdrawalPin', code: 'WALLET_PIN_WEAK' },
      ]);
    }

    const otpConfig = await systemConfig.getOtpConfig();

    if (!(await underSendLimit(normalizedEmail, 'REGISTER', otpConfig.otpMaxSendsPerHour))) {
      throw rateLimited();
    }

    const score = scoreSkillSurvey(survey.definition, input.skillSurvey.answers);
    const levels = await skillSurveyRepository.listSkillLevels();
    const levelId = (code: string) => {
      const level = levels.find(l => l.code === code);
      if (!level) throw new Error(`Skill level ${code} is missing from the catalog`);
      return level.id;
    };

    const [passwordHash, pinHash] = await Promise.all([
      passwordHasher.hashPassword(input.password),
      withdrawalPinHasher.hash(input.withdrawalPin),
    ]);

    const pendingId = generateChallengeId();
    const challengeId = generateChallengeId();
    const otp = generateOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + otpConfig.otpTtlMinutes * 60_000);
    const resendAvailableAt = new Date(now.getTime() + otpConfig.otpResendSeconds * 1000);
    const result = toSkillSurveyResult(survey.version, score, levels, true);

    await db.transaction(async (tx) => {
      if (input.previousChallengeId) {
        const previous = await challengeRepository.findChallenge(input.previousChallengeId, tx, true);
        if (previous?.purpose === 'REGISTER') {
          await challengeRepository.deleteChallenge(previous.id, tx);
          if (previous.pendingRegistrationId) {
            await challengeRepository.deletePendingRegistration(previous.pendingRegistrationId, tx);
          }
        }
      }

      await challengeRepository.createPendingRegistration(
        {
          id: pendingId,
          email: normalizedEmail,
          passwordHash,
          pinHash,
          fullName: input.fullName.trim(),
          phone: input.phone ?? null,
          skillLevelId: levelId(score.skillLevelCode),
          surveySnapshot: {
            version: survey.version,
            answers: input.skillSurvey.answers,
            components: score.components,
            rawScore: score.rawScore,
            finalScore: score.finalScore,
            nominalSkillLevelId: levelId(score.nominalSkillLevelCode),
            appliedGuardrails: score.appliedGuardrails,
            result,
          } as Record<string, unknown>,
          expiresAt: new Date(now.getTime() + otpConfig.pendingRegistrationTtlMinutes * 60_000),
        },
        tx
      );

      await challengeRepository.createChallenge(
        {
          id: challengeId,
          purpose: 'REGISTER',
          email: normalizedEmail,
          pendingRegistrationId: pendingId,
          otpDigest: computeOtpDigest({ challengeId, purpose: 'REGISTER', generation: 1, otp }),
          expiresAt,
          resendAvailableAt,
        },
        tx
      );

      await emailOutboxService.enqueue(tx, {
        to: normalizedEmail,
        template: 'REGISTER_OTP',
        data: { otp, expiresInMinutes: otpConfig.otpTtlMinutes, challengeId },
        idempotencyKey: `otp:${challengeId}:1`,
      });
    });

    emailOutboxService.processSoon();

    logger.info('Registration OTP requested', {
      email: normalizedEmail,
      challengeId,
      skillSurveyVersion: survey.version,
    });

    return { challengeId, expiresAt, resendAvailableAt };
  },

  /**
   * Completes a pending registration after the email OTP is verified.
   */
  async verifyRegistration(body: unknown) {
    const input = parseChallengeOtp(body);
    const otpConfig = await systemConfig.getOtpConfig();
    const challenge = await requireChallenge(input.challengeId, 'REGISTER');
    await checkChallengeOtp(challenge, input.otp, otpConfig.otpMaxAttempts);

    if (!challenge.pendingRegistrationId) throw otpInvalid();

    const pending = await challengeRepository.findPendingRegistration(challenge.pendingRegistrationId);
    if (!pending) throw otpInvalid();
    if (pending.expiresAt <= new Date()) {
      await challengeRepository.consumeChallenge(challenge.id, challenge.generation);
      await challengeRepository.deletePendingRegistration(pending.id);
      throw otpExpired();
    }

    const existingUser = await authRepository.findUserByEmail(pending.email);
    if (existingUser) {
      await challengeRepository.consumeChallenge(challenge.id, challenge.generation);
      await challengeRepository.deletePendingRegistration(pending.id);
      throw new AppError('AUTH_EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');
    }

    const snapshot = pending.surveySnapshot as {
      version: number;
      answers: Record<string, string | number | boolean>;
      components: { K: number; R: number; X: number; P: number; A: number; T: number };
      rawScore: number;
      finalScore: number;
      nominalSkillLevelId: number;
      appliedGuardrails: string[];
      result: SkillSurveyResult;
    };

    try {
      const result = await authRepository.completePlayerRegistration({
        challengeId: challenge.id,
        challengeGeneration: challenge.generation,
        pendingRegistrationId: pending.id,
        email: pending.email,
        passwordHash: pending.passwordHash,
        pinHash: pending.pinHash,
        fullName: pending.fullName,
        phone: pending.phone,
        skillLevelId: pending.skillLevelId,
        survey: {
          version: snapshot.version,
          answers: snapshot.answers,
          components: snapshot.components,
          rawScore: snapshot.rawScore,
          finalScore: snapshot.finalScore,
          nominalSkillLevelId: snapshot.nominalSkillLevelId,
          appliedGuardrails: snapshot.appliedGuardrails,
        },
      });

      logger.info('User registered successfully', {
        userId: result.user.id,
        role: 'PLAYER',
        skillSurveyVersion: snapshot.version,
      });

      return { ...result, skillSurveyResult: snapshot.result };
    } catch (err: any) {
      if (err?.code === '23505' || err?.message?.includes('users_email_unique')) {
        await challengeRepository.consumeChallenge(challenge.id, challenge.generation);
        await challengeRepository.deletePendingRegistration(pending.id);
        throw new AppError('AUTH_EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');
      }
      throw err;
    }
  },

  /** Resends the registration OTP; invalidates the previous code via generation. */
  async resendRegistrationOtp(body: unknown) {
    const input = parseChallengeId(body);
    const otpConfig = await systemConfig.getOtpConfig();
    const challenge = await requireChallenge(input.challengeId, 'REGISTER');
    return resendChallenge(challenge, {
      resendSeconds: otpConfig.otpResendSeconds,
      maxSendsPerHour: otpConfig.otpMaxSendsPerHour,
      ttlMinutes: otpConfig.otpTtlMinutes,
    });
  },

  /**
   * Starts password recovery. The response has the same shape whether or not the
   * email belongs to an eligible account; a fake challenge can never be verified.
   */
  async forgotPassword(body: unknown) {
    const input = parseForgotPassword(body);
    const email = input.email.trim().toLowerCase();
    const user = await authRepository.findUserByEmail(email);
    const otpConfig = await systemConfig.getOtpConfig();
    const eligible = Boolean(user && user.deletedAt === null && user.status === 'ACTIVE');
    const allowed = eligible && (await underSendLimit(email, 'PASSWORD_RESET', otpConfig.otpMaxSendsPerHour));

    const challengeId = generateChallengeId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + otpConfig.otpTtlMinutes * 60_000);
    const resendAvailableAt = new Date(now.getTime() + otpConfig.otpResendSeconds * 1000);

    if (!allowed || !user) {
      await challengeRepository.createChallenge({
        id: challengeId,
        purpose: 'PASSWORD_RESET',
        email,
        otpDigest: null,
        expiresAt,
        resendAvailableAt,
      });
      return { challengeId, expiresAt, resendAvailableAt };
    }

    const otp = generateOtp();
    await db.transaction(async (tx) => {
      await challengeRepository.createChallenge(
        {
          id: challengeId,
          purpose: 'PASSWORD_RESET',
          email,
          userId: user.id,
          otpDigest: computeOtpDigest({ challengeId, purpose: 'PASSWORD_RESET', generation: 1, otp }),
          expiresAt,
          resendAvailableAt,
        },
        tx
      );
      await emailOutboxService.enqueue(tx, {
        to: email,
        template: 'PASSWORD_RESET_OTP',
        data: { otp, expiresInMinutes: otpConfig.otpTtlMinutes, challengeId },
        idempotencyKey: `otp:${challengeId}:1`,
      });
    });
    emailOutboxService.processSoon();

    return { challengeId, expiresAt, resendAvailableAt };
  },

  /** Verifies a PASSWORD_RESET OTP and returns a short-lived reset token. */
  async verifyPasswordReset(body: unknown) {
    const input = parseChallengeOtp(body);
    const otpConfig = await systemConfig.getOtpConfig();
    const challenge = await requireChallenge(input.challengeId, 'PASSWORD_RESET');
    // Fake challenges must take the same attempt-counting path as real ones.
    await checkChallengeOtp(challenge, input.otp, otpConfig.otpMaxAttempts);
    if (!challenge.userId) throw otpInvalid();

    const rawToken = generateResetToken();
    const expiresAt = new Date(Date.now() + otpConfig.resetTokenTtlMinutes * 60_000);

    await db.transaction(async (tx) => {
      const locked = await challengeRepository.findChallenge(challenge.id, tx, true);
      if (
        !locked ||
        locked.consumedAt ||
        locked.generation !== challenge.generation ||
        !locked.userId ||
        !locked.otpDigest ||
        !otpDigestMatches(
          locked.otpDigest,
          computeOtpDigest({
            challengeId: locked.id,
            purpose: 'PASSWORD_RESET',
            generation: locked.generation,
            otp: input.otp,
          })
        )
      ) {
        throw otpInvalid();
      }
      const consumed = await challengeRepository.consumeChallenge(locked.id, locked.generation, tx);
      if (!consumed) throw otpInvalid();

      await challengeRepository.createResetToken(
        {
          tokenHash: hashResetToken(rawToken),
          userId: locked.userId,
          challengeId: locked.id,
          purpose: 'PASSWORD_RESET',
          expiresAt,
        },
        tx
      );
      await authRepository.markEmailVerified(locked.userId, tx);
    });

    logger.info('Password reset authorized', { userId: challenge.userId });
    return { resetToken: rawToken, expiresAt };
  },

  /** Applies a verified password reset and revokes every active session. */
  async resetPassword(body: unknown) {
    const tokenInput = body as { resetToken?: unknown };
    if (typeof tokenInput?.resetToken !== 'string' || !tokenInput.resetToken.trim()) {
      throw new AppError('VALIDATION_FAILED', 400, 'Validation failed', [
        { field: 'resetToken', code: 'VALIDATION_FAILED' },
      ]);
    }
    const tokenHash = hashResetToken(tokenInput.resetToken.trim());
    const row = await challengeRepository.findResetTokenByHash(tokenHash);
    if (!row || row.consumedAt || row.expiresAt <= new Date() || row.purpose !== 'PASSWORD_RESET') {
      throw new AppError('AUTH_RESET_TOKEN_INVALID', 400, 'Reset authorization is invalid or expired');
    }

    const user = await authRepository.findUserById(row.userId);
    if (!user || user.deletedAt !== null || user.status !== 'ACTIVE') {
      throw new AppError('AUTH_RESET_TOKEN_INVALID', 400, 'Reset authorization is invalid or expired');
    }

    const input = validateResetPasswordInput(body, user.email);
    const passwordHash = await passwordHasher.hashPassword(input.newPassword);

    await db.transaction(async (tx) => {
      const locked = await challengeRepository.findResetTokenByHash(tokenHash, tx, true);
      if (!locked || locked.consumedAt || locked.expiresAt <= new Date() || locked.purpose !== 'PASSWORD_RESET') {
        throw new AppError('AUTH_RESET_TOKEN_INVALID', 400, 'Reset authorization is invalid or expired');
      }
      const consumed = await challengeRepository.consumeResetToken(locked.id, tx);
      if (!consumed) {
        throw new AppError('AUTH_RESET_TOKEN_INVALID', 400, 'Reset authorization is invalid or expired');
      }
      await challengeRepository.consumeOtherResetTokens(locked.userId, 'PASSWORD_RESET', locked.id, tx);
      await challengeRepository.consumeAllResetTokens(locked.userId, 'PASSWORD_CHANGE', tx);
      await authRepository.updateUserPassword(locked.userId, passwordHash, tx);
      await authRepository.markEmailVerified(locked.userId, tx);
      await authRepository.revokeAllSessionsForUser(locked.userId, tx);
      await authRepository.resetLoginLockout(locked.userId, tx);
    });

    logger.info('Password reset completed', { userId: row.userId });
  },

  /** Resends a password recovery OTP; fake challenges never send mail. */
  async resendPasswordResetOtp(body: unknown) {
    const input = parseChallengeId(body);
    const otpConfig = await systemConfig.getOtpConfig();
    const challenge = await requireChallenge(input.challengeId, 'PASSWORD_RESET');
    return resendChallenge(challenge, {
      resendSeconds: otpConfig.otpResendSeconds,
      maxSendsPerHour: otpConfig.otpMaxSendsPerHour,
      ttlMinutes: otpConfig.otpTtlMinutes,
    });
  },

  /**
   * Issues a withdrawal PIN reset authorization to the signed-in user's own email.
   * Used both for the first PIN setup and for forgotten PINs.
   */
  async requestWithdrawalPinReset(userId: number) {
    const user = await authRepository.findUserById(userId);
    if (!user || user.deletedAt !== null || user.status !== 'ACTIVE') {
      throw new AppError('AUTH_SESSION_INVALID', 401, 'Authentication session is invalid');
    }
    const otpConfig = await systemConfig.getOtpConfig();
    if (!(await underSendLimit(user.email, 'WITHDRAWAL_PIN_RESET', otpConfig.otpMaxSendsPerHour))) throw rateLimited();

    const challengeId = generateChallengeId();
    const otp = generateOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + otpConfig.otpTtlMinutes * 60_000);
    const resendAvailableAt = new Date(now.getTime() + otpConfig.otpResendSeconds * 1000);

    await db.transaction(async (tx) => {
      await challengeRepository.createChallenge(
        {
          id: challengeId,
          purpose: 'WITHDRAWAL_PIN_RESET',
          email: user.email,
          userId,
          otpDigest: computeOtpDigest({
            challengeId,
            purpose: 'WITHDRAWAL_PIN_RESET',
            generation: 1,
            otp,
          }),
          expiresAt,
          resendAvailableAt,
        },
        tx
      );
      await emailOutboxService.enqueue(tx, {
        to: user.email,
        template: 'WITHDRAWAL_PIN_RESET_OTP',
        data: { otp, expiresInMinutes: otpConfig.otpTtlMinutes, challengeId },
        idempotencyKey: `otp:${challengeId}:1`,
      });
    });
    emailOutboxService.processSoon();

    return { challengeId, expiresAt, resendAvailableAt };
  },

  /** Verifies a WITHDRAWAL_PIN_RESET OTP for the signed-in user. */
  async verifyWithdrawalPinReset(userId: number, body: unknown) {
    const input = parseChallengeOtp(body);
    const otpConfig = await systemConfig.getOtpConfig();
    const challenge = await requireChallenge(input.challengeId, 'WITHDRAWAL_PIN_RESET', userId);
    await checkChallengeOtp(challenge, input.otp, otpConfig.otpMaxAttempts);

    const rawToken = generateResetToken();
    const expiresAt = new Date(Date.now() + otpConfig.resetTokenTtlMinutes * 60_000);

    await db.transaction(async (tx) => {
      const locked = await challengeRepository.findChallenge(challenge.id, tx, true);
      if (
        !locked ||
        locked.consumedAt ||
        locked.userId !== userId ||
        locked.generation !== challenge.generation ||
        !locked.otpDigest ||
        !otpDigestMatches(
          locked.otpDigest,
          computeOtpDigest({
            challengeId: locked.id,
            purpose: 'WITHDRAWAL_PIN_RESET',
            generation: locked.generation,
            otp: input.otp,
          })
        )
      ) {
        throw otpInvalid();
      }
      const consumed = await challengeRepository.consumeChallenge(locked.id, locked.generation, tx);
      if (!consumed) throw otpInvalid();

      await challengeRepository.createResetToken(
        {
          tokenHash: hashResetToken(rawToken),
          userId,
          challengeId: locked.id,
          purpose: 'WITHDRAWAL_PIN_RESET',
          expiresAt,
        },
        tx
      );
      await authRepository.markEmailVerified(userId, tx);
    });

    return { resetToken: rawToken, expiresAt };
  },

  /** Applies a verified withdrawal PIN reset; the old PIN stops working immediately. */
  async resetWithdrawalPin(userId: number, resetToken: string, newPin: string) {
    if (!isWithdrawalPinAcceptable(newPin)) {
      throw new AppError('WALLET_PIN_WEAK', 400, 'Withdrawal PIN is too weak', [
        { field: 'newPin', code: 'WALLET_PIN_WEAK' },
      ]);
    }

    const tokenHash = hashResetToken(resetToken);
    const row = await challengeRepository.findResetTokenByHash(tokenHash);
    if (
      !row ||
      row.userId !== userId ||
      row.consumedAt ||
      row.expiresAt <= new Date() ||
      row.purpose !== 'WITHDRAWAL_PIN_RESET'
    ) {
      throw new AppError('AUTH_RESET_TOKEN_INVALID', 400, 'Reset authorization is invalid or expired');
    }

    await db.transaction(async (tx) => {
      const locked = await challengeRepository.findResetTokenByHash(tokenHash, tx, true);
      if (
        !locked ||
        locked.userId !== userId ||
        locked.consumedAt ||
        locked.expiresAt <= new Date() ||
        locked.purpose !== 'WITHDRAWAL_PIN_RESET'
      ) {
        throw new AppError('AUTH_RESET_TOKEN_INVALID', 400, 'Reset authorization is invalid or expired');
      }
      const consumed = await challengeRepository.consumeResetToken(locked.id, tx);
      if (!consumed) {
        throw new AppError('AUTH_RESET_TOKEN_INVALID', 400, 'Reset authorization is invalid or expired');
      }
      await challengeRepository.consumeOtherResetTokens(userId, 'WITHDRAWAL_PIN_RESET', locked.id, tx);
      await withdrawalPinService.resetPin(userId, newPin, tx);
      await authRepository.markEmailVerified(userId, tx);
    });

    logger.info('Withdrawal PIN reset completed', { userId });
  },

  /** Resends a withdrawal PIN OTP for the signed-in user's own challenge. */
  async resendWithdrawalPinOtp(userId: number, body: unknown) {
    const input = parseChallengeId(body);
    const otpConfig = await systemConfig.getOtpConfig();
    const challenge = await requireChallenge(input.challengeId, 'WITHDRAWAL_PIN_RESET', userId);
    return resendChallenge(challenge, {
      resendSeconds: otpConfig.otpResendSeconds,
      maxSendsPerHour: otpConfig.otpMaxSendsPerHour,
      ttlMinutes: otpConfig.otpTtlMinutes,
    });
  },

  /**
   * Signs in a user, evaluates lockout rules, and creates a session.
   */
  async login(input: LoginDto) {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Look up user by email
    const user = await authRepository.findUserByEmail(normalizedEmail);

    // 2. Unknown email or soft-deleted account -> dummy verification + 401
    if (!user || user.deletedAt !== null) {
      await passwordHasher.dummyVerify(input.password);
      logger.warn('Failed login attempt', {
        reason: !user ? 'unknown_email' : 'soft_deleted',
      });
      throw new AppError('AUTH_INVALID_CREDENTIALS', 401, 'Invalid email or password');
    }

    // 3. Check persistent lockout
    const lockoutConfig = await systemConfig.getLoginLockoutConfig();
    const lockout = await authRepository.getLoginLockout(user.id);
    const now = new Date();

    if (lockout?.lockedUntil && lockout.lockedUntil > now) {
      const retryAfterSeconds = Math.max(1, Math.ceil((lockout.lockedUntil.getTime() - now.getTime()) / 1000));
      logger.warn('Login attempt on locked account', {
        userId: user.id,
        reason: 'locked',
        lockedUntil: lockout.lockedUntil.toISOString(),
      });

      const error = new AppError(
        'AUTH_ACCOUNT_LOCKED',
        429,
        'Account is temporarily locked due to multiple failed login attempts',
        [{ lockedUntil: lockout.lockedUntil.toISOString() }]
      );
      (error as any).retryAfterSeconds = retryAfterSeconds;
      throw error;
    }

    // 4. Verify password
    const isPasswordValid = await passwordHasher.verifyPassword(input.password, user.passwordHash);

    if (!isPasswordValid) {
      const updatedLockout = await authRepository.recordFailedLogin(
        user.id,
        lockoutConfig.threshold,
        lockoutConfig.lockoutMinutes
      );

      const isNowLocked = updatedLockout?.lockedUntil && updatedLockout.lockedUntil > now;
      logger.warn('Failed login attempt', {
        userId: user.id,
        reason: 'wrong_password',
        locked: !!isNowLocked,
      });

      throw new AppError('AUTH_INVALID_CREDENTIALS', 401, 'Invalid email or password');
    }

    // 5. Correct password -> reset lockout
    await authRepository.resetLoginLockout(user.id);

    // 6. Check account status
    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      logger.warn('Login attempt on restricted account', {
        userId: user.id,
        reason: user.status.toLowerCase(),
      });
      throw new AppError('AUTH_ACCOUNT_RESTRICTED', 403, 'Account is suspended or deactivated');
    }

    // 7. Cleanup revoked/expired sessions and create new session (single transaction)
    const { rawToken, session } = await authRepository.createLoginSession(user.id, user.role as SystemRole);

    logger.info('User logged in successfully', {
      userId: user.id,
      role: user.role,
      reason: 'success',
    });

    return {
      user,
      rawToken,
      session,
    };
  },

  /**
   * Signs out a user by revoking the session token.
   */
  async logout(rawToken?: string): Promise<void> {
    if (rawToken) {
      await authRepository.revokeSessionByToken(rawToken);
      logger.info('Session revoked', { trigger: 'sign_out' });
    }
  },

  /**
   * Sends an OTP to the signed-in user's own email before a voluntary password
   * change. The forced first sign-in change does not use this flow.
   */
  async requestPasswordChangeOtp(userId: number) {
    const user = await authRepository.findUserById(userId);
    if (!user || user.deletedAt !== null || user.status !== 'ACTIVE') {
      throw new AppError('AUTH_SESSION_INVALID', 401, 'Authentication session is invalid');
    }

    const otpConfig = await systemConfig.getOtpConfig();
    if (!(await underSendLimit(user.email, 'PASSWORD_CHANGE', otpConfig.otpMaxSendsPerHour))) {
      throw rateLimited();
    }

    const challengeId = generateChallengeId();
    const otp = generateOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + otpConfig.otpTtlMinutes * 60_000);
    const resendAvailableAt = new Date(now.getTime() + otpConfig.otpResendSeconds * 1000);

    await db.transaction(async (tx) => {
      await challengeRepository.createChallenge(
        {
          id: challengeId,
          purpose: 'PASSWORD_CHANGE',
          email: user.email,
          userId,
          otpDigest: computeOtpDigest({
            challengeId,
            purpose: 'PASSWORD_CHANGE',
            generation: 1,
            otp,
          }),
          expiresAt,
          resendAvailableAt,
        },
        tx
      );
      await emailOutboxService.enqueue(tx, {
        to: user.email,
        template: 'PASSWORD_CHANGE_OTP',
        data: { otp, expiresInMinutes: otpConfig.otpTtlMinutes, challengeId },
        idempotencyKey: `otp:${challengeId}:1`,
      });
    });
    emailOutboxService.processSoon();

    return { challengeId, expiresAt, resendAvailableAt };
  },

  /** Verifies the voluntary password-change OTP and issues a short-lived authorization. */
  async verifyPasswordChangeOtp(userId: number, body: unknown) {
    const input = parseChallengeOtp(body);
    const otpConfig = await systemConfig.getOtpConfig();
    const challenge = await requireChallenge(input.challengeId, 'PASSWORD_CHANGE', userId);
    await checkChallengeOtp(challenge, input.otp, otpConfig.otpMaxAttempts);

    const rawToken = generateResetToken();
    const expiresAt = new Date(Date.now() + otpConfig.resetTokenTtlMinutes * 60_000);

    await db.transaction(async (tx) => {
      const locked = await challengeRepository.findChallenge(challenge.id, tx, true);
      if (
        !locked ||
        locked.consumedAt ||
        locked.userId !== userId ||
        locked.generation !== challenge.generation ||
        !locked.otpDigest ||
        !otpDigestMatches(
          locked.otpDigest,
          computeOtpDigest({
            challengeId: locked.id,
            purpose: 'PASSWORD_CHANGE',
            generation: locked.generation,
            otp: input.otp,
          })
        )
      ) {
        throw otpInvalid();
      }
      const consumed = await challengeRepository.consumeChallenge(locked.id, locked.generation, tx);
      if (!consumed) throw otpInvalid();

      await challengeRepository.createResetToken(
        {
          tokenHash: hashResetToken(rawToken),
          userId,
          challengeId: locked.id,
          purpose: 'PASSWORD_CHANGE',
          expiresAt,
        },
        tx
      );
      await authRepository.markEmailVerified(userId, tx);
    });

    return { resetToken: rawToken, expiresAt };
  },

  /** Resends the voluntary password-change OTP for the signed-in user. */
  async resendPasswordChangeOtp(userId: number, body: unknown) {
    const input = parseChallengeId(body);
    const otpConfig = await systemConfig.getOtpConfig();
    const challenge = await requireChallenge(input.challengeId, 'PASSWORD_CHANGE', userId);
    return resendChallenge(challenge, {
      resendSeconds: otpConfig.otpResendSeconds,
      maxSendsPerHour: otpConfig.otpMaxSendsPerHour,
      ttlMinutes: otpConfig.otpTtlMinutes,
    });
  },

  /**
   * Changes the password for an authenticated user. A forced first sign-in change
   * (Admin-generated temporary password) is allowed without OTP; a voluntary
   * change requires a PASSWORD_CHANGE authorization issued after email OTP verification.
   */
  async changePassword(userId: number, input: ChangePasswordDto) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError('AUTH_SESSION_INVALID', 401, 'User not found');
    }

    // Verify current password
    const isCurrentValid = await passwordHasher.verifyPassword(input.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new AppError('AUTH_CURRENT_PASSWORD_INCORRECT', 400, 'Current password is incorrect');
    }

    const newPasswordHash = await passwordHasher.hashPassword(input.newPassword);

    if (user.mustChangePassword) {
      // Forced first sign-in after an Admin reset: no email OTP, but clear any
      // outstanding password reset/change authorizations.
      const updatedUser = await db.transaction(async (tx) => {
        await challengeRepository.consumeAllResetTokens(userId, 'PASSWORD_RESET', tx);
        await challengeRepository.consumeAllResetTokens(userId, 'PASSWORD_CHANGE', tx);
        return authRepository.updateUserPassword(userId, newPasswordHash, tx);
      });
      logger.info('Password changed successfully', { userId, forced: true });
      return updatedUser;
    }

    if (!input.resetToken) {
      throw new AppError(
        'AUTH_PASSWORD_CHANGE_OTP_REQUIRED',
        400,
        'Email verification is required before changing the password'
      );
    }

    const tokenHash = hashResetToken(input.resetToken);
    const row = await challengeRepository.findResetTokenByHash(tokenHash);
    if (
      !row ||
      row.userId !== userId ||
      row.consumedAt ||
      row.expiresAt <= new Date() ||
      row.purpose !== 'PASSWORD_CHANGE'
    ) {
      throw new AppError('AUTH_RESET_TOKEN_INVALID', 400, 'Reset authorization is invalid or expired');
    }

    const updatedUser = await db.transaction(async (tx) => {
      const locked = await challengeRepository.findResetTokenByHash(tokenHash, tx, true);
      if (
        !locked ||
        locked.userId !== userId ||
        locked.consumedAt ||
        locked.expiresAt <= new Date() ||
        locked.purpose !== 'PASSWORD_CHANGE'
      ) {
        throw new AppError('AUTH_RESET_TOKEN_INVALID', 400, 'Reset authorization is invalid or expired');
      }
      const consumed = await challengeRepository.consumeResetToken(locked.id, tx);
      if (!consumed) {
        throw new AppError('AUTH_RESET_TOKEN_INVALID', 400, 'Reset authorization is invalid or expired');
      }
      await challengeRepository.consumeAllResetTokens(userId, 'PASSWORD_CHANGE', tx);
      await challengeRepository.consumeAllResetTokens(userId, 'PASSWORD_RESET', tx);
      return authRepository.updateUserPassword(userId, newPasswordHash, tx);
    });

    logger.info('Password changed successfully', { userId, forced: false });
    return updatedUser;
  },

  /**
   * Admin creates a Court Owner account.
   */
  async createCourtOwnerAccount(input: CreateCourtOwnerDto) {
    const normalizedEmail = input.email.trim().toLowerCase();

    if (!isPasswordPolicySatisfied(input.initialPassword, normalizedEmail)) {
      throw new AppError('AUTH_PASSWORD_POLICY_VIOLATION', 400, 'Password does not satisfy policy requirements', [
        { field: 'initialPassword', code: 'AUTH_PASSWORD_POLICY_VIOLATION' },
      ]);
    }

    const existing = await authRepository.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new AppError('AUTH_EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');
    }

    const passwordHash = await passwordHasher.hashPassword(input.initialPassword);

    try {
      const newUser = await authRepository.createCourtOwnerAccount({
        email: normalizedEmail,
        passwordHash,
        businessName: input.businessName.trim(),
        phone: input.phone.trim(),
      });

      logger.info('Court Owner account created by admin', {
        userId: newUser.id,
        role: 'COURT_OWNER',
      });

      return newUser;
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('users_email_unique')) {
        throw new AppError('AUTH_EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');
      }
      throw err;
    }
  },

  /**
   * Admin sets a user's password, forcing password change on next login.
   */
  async adminSetPassword(userId: number, newPassword: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError('NOT_FOUND', 404, 'User not found');
    }

    if (!isPasswordPolicySatisfied(newPassword, user.email)) {
      throw new AppError('AUTH_PASSWORD_POLICY_VIOLATION', 400, 'Password does not satisfy policy requirements', [
        { field: 'newPassword', code: 'AUTH_PASSWORD_POLICY_VIOLATION' },
      ]);
    }

    const passwordHash = await passwordHasher.hashPassword(newPassword);
    const updated = await authRepository.adminSetUserPassword(userId, passwordHash);
    if (!updated) {
      throw new AppError('NOT_FOUND', 404, 'User not found');
    }

    logger.info('Session revoked', { userId, trigger: 'admin_set_password' });

    return updated;
  },

  /**
   * Provisions an Admin account (AUTH-14).
   */
  async createAdminAccount(input: { email: string; password: string }) {
    const normalizedEmail = input.email.trim().toLowerCase();

    if (!isPasswordPolicySatisfied(input.password, normalizedEmail)) {
      throw new AppError('AUTH_PASSWORD_POLICY_VIOLATION', 400, 'Password does not satisfy policy requirements', [
        { field: 'password', code: 'AUTH_PASSWORD_POLICY_VIOLATION' },
      ]);
    }

    const existing = await authRepository.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new AppError('AUTH_EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');
    }

    const passwordHash = await passwordHasher.hash(input.password);

    try {
      const newUser = await authRepository.createAdminUser({
        email: normalizedEmail,
        passwordHash,
      });

      logger.info('Admin account provisioned', {
        userId: newUser.id,
        role: 'ADMIN',
      });

      return newUser;
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('users_email_unique')) {
        throw new AppError('AUTH_EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');
      }
      throw err;
    }
  },
};
