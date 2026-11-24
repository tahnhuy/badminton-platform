import { playerPhone } from './player-contact';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import { validateSurveyAnswers, type SkillSurveyDefinition } from '../services/auth/skill-survey';

export interface FieldErrorDetail {
  field: string;
  code: string;
}

export function countCodePoints(str: string): number {
  return Array.from(str.normalize('NFKC')).length;
}

export function isPasswordPolicySatisfied(password: string, email?: string): boolean {
  const normalized = password.normalize('NFKC');
  const codePoints = Array.from(normalized).length;

  if (codePoints < 8 || codePoints > 64 || !/\p{L}/u.test(normalized) || !/[0-9]/.test(normalized)) {
    return false;
  }

  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalized.toLowerCase() === normalizedEmail) {
      return false;
    }
  }

  return true;
}

/** `skillSurvey` body of POST /auth/register (Auth Tech Design API table). */
export const skillSurveyAnswersSchema = z
  .object({
    version: z.number().int().positive(),
    answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  })
  .strict();

export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .max(254)
      .email(),
    password: z.string(),
    fullName: z
      .string()
      .trim()
      .min(1)
      .max(255),
    phone: playerPhone.optional(),
    /** Reusable 6-digit withdrawal PIN, set by the user at registration (§3.1). */
    withdrawalPin: z.string().regex(/^\d{6}$/, 'Withdrawal PIN must be 6 digits'),
    withdrawalPinConfirm: z.string(),
    /** The client's previous pending challenge, cancelled when the email changes. */
    previousChallengeId: z.string().trim().min(1).max(64).optional(),
    skillSurvey: skillSurveyAnswersSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!isPasswordPolicySatisfied(data.password, data.email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Password does not satisfy policy requirements',
        params: { errorCode: 'AUTH_PASSWORD_POLICY_VIOLATION' },
      });
    }
    if (data.withdrawalPin !== data.withdrawalPinConfirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['withdrawalPinConfirm'],
        message: 'Withdrawal PIN confirmation does not match',
      });
    }
  });

export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .max(254)
      .email(),
    password: z
      .string()
      .min(1)
      .max(1024),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1)
      .max(1024),
    newPassword: z.string(),
    /** Present only for a voluntary change after the email OTP verification. */
    resetToken: z.string().trim().min(1).max(512).optional(),
  })
  .strict();

export function mapZodIssuesToDetails(issues: z.ZodIssue[]): {
  topLevelCode: string;
  details: FieldErrorDetail[];
} {
  const details: FieldErrorDetail[] = [];
  const seenFields = new Set<string>();

  for (const issue of issues) {
    // Survey answer issues are reported per question id (Auth Tech Design "Validation and errors").
    const field = issue.path[0] === 'skillSurvey' && issue.path[1] === 'answers' && issue.path.length > 2
      ? String(issue.path[2])
      : issue.path.length > 0 ? String(issue.path[0]) : 'body';
    if (seenFields.has(field)) {
      continue;
    }
    seenFields.add(field);

    let code = 'VALIDATION_FAILED';
    if (issue.code === z.ZodIssueCode.custom && (field === 'password' || field === 'newPassword')) {
      code = 'AUTH_PASSWORD_POLICY_VIOLATION';
    }

    details.push({ field, code });
  }

  // Top-level code logic:
  // If every failing field has the same code, use that code.
  // Otherwise use VALIDATION_FAILED.
  const uniqueCodes = new Set(details.map((d) => d.code));
  const topLevelCode = uniqueCodes.size === 1 ? details[0].code : 'VALIDATION_FAILED';

  return { topLevelCode, details };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check (1) on register: an old open form still sends `skillLevelCode`.
 * Runs before the strict schema, which would otherwise reject the unknown key.
 */
export function rejectOldRegistrationForm(body: unknown): void {
  if (isPlainObject(body) && Object.prototype.hasOwnProperty.call(body, 'skillLevelCode')) {
    throw new AppError('AUTH_REGISTRATION_FORM_OUTDATED', 400, 'Registration form is outdated; reload the page');
  }
}

/**
 * Check (3) on register: a numeric `skillSurvey.version` that is not the ACTIVE
 * version. A missing or malformed version is left to the schema (check 4).
 */
export function rejectOutdatedSurveyVersion(body: unknown, activeVersion: number): void {
  const survey = isPlainObject(body) ? body.skillSurvey : undefined;
  const version = isPlainObject(survey) ? survey.version : undefined;
  if (typeof version === 'number' && version !== activeVersion) {
    throw new AppError('AUTH_SKILL_SURVEY_OUTDATED', 400, 'Skill survey version is outdated; reload the page');
  }
}

/**
 * Check (4) on register: strict body schema plus answers against the ACTIVE
 * definition. All field errors are returned together; answer errors use the
 * question id as `field`.
 */
export function validateRegisterInput(
  body: unknown,
  definition: SkillSurveyDefinition,
): z.infer<typeof registerSchema> {
  const result = registerSchema.safeParse(body);
  const { details } = result.success ? { details: [] as FieldErrorDetail[] } : mapZodIssuesToDetails(result.error.issues);

  // Validate the raw answers object (not the Zod output): Zod drops keys such as
  // `__proto__`, which must still be rejected as unknown, and a type error in one
  // answer must not hide missing or unknown questions.
  const rawSurvey = isPlainObject(body) ? body.skillSurvey : undefined;
  const rawAnswers = isPlainObject(rawSurvey) ? rawSurvey.answers : undefined;
  if (isPlainObject(rawAnswers)) {
    const seen = new Set(details.map(d => d.field));
    for (const error of validateSurveyAnswers(definition, rawAnswers)) {
      if (!seen.has(error.field)) details.push(error);
    }
  }

  if (!result.success || details.length > 0) {
    const codes = new Set(details.map(d => d.code));
    const topLevelCode = codes.size === 1 ? details[0].code : 'VALIDATION_FAILED';
    throw new AppError(topLevelCode, 400, 'Validation failed', details);
  }
  return {
    ...result.data,
    email: result.data.email.trim().toLowerCase(),
    fullName: result.data.fullName.trim(),
  };
}

export function validateLoginInput(body: unknown): z.infer<typeof loginSchema> {
  const result = loginSchema.safeParse(body);
  if (!result.success) {
    const { topLevelCode, details } = mapZodIssuesToDetails(result.error.issues);
    throw new AppError(topLevelCode, 400, 'Validation failed', details);
  }
  return {
    ...result.data,
    email: result.data.email.trim().toLowerCase(),
  };
}

export function validateChangePasswordInput(
  body: unknown,
  userEmail?: string
): z.infer<typeof changePasswordSchema> {
  const result = changePasswordSchema.safeParse(body);
  if (!result.success) {
    const { topLevelCode, details } = mapZodIssuesToDetails(result.error.issues);
    throw new AppError(topLevelCode, 400, 'Validation failed', details);
  }

  if (!isPasswordPolicySatisfied(result.data.newPassword, userEmail)) {
    const details = [{ field: 'newPassword', code: 'AUTH_PASSWORD_POLICY_VIOLATION' }];
    throw new AppError('AUTH_PASSWORD_POLICY_VIOLATION', 400, 'Password policy violation', details);
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// Email OTP / password recovery / withdrawal PIN (email-otp plan §5)
// ---------------------------------------------------------------------------

export const challengeOtpSchema = z
  .object({
    challengeId: z.string().trim().min(1).max(64),
    otp: z.string().trim().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
  })
  .strict();

export const challengeIdSchema = z
  .object({
    challengeId: z.string().trim().min(1).max(64),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: z
      .string()
      .trim()
      .max(254)
      .email(),
  })
  .strict();

export const resetTokenSchema = z
  .object({
    resetToken: z.string().trim().min(1).max(512),
  })
  .strict();

export function validateResetPasswordInput(body: unknown, userEmail?: string): {
  resetToken: string;
  newPassword: string;
} {
  const schema = resetTokenSchema.extend({ newPassword: z.string() }).strict();
  const result = schema.safeParse(body);
  if (!result.success) {
    const { topLevelCode, details } = mapZodIssuesToDetails(result.error.issues);
    throw new AppError(topLevelCode, 400, 'Validation failed', details);
  }
  if (!isPasswordPolicySatisfied(result.data.newPassword, userEmail)) {
    throw new AppError(
      'AUTH_PASSWORD_POLICY_VIOLATION',
      400,
      'Password policy violation',
      [{ field: 'newPassword', code: 'AUTH_PASSWORD_POLICY_VIOLATION' }]
    );
  }
  return { resetToken: result.data.resetToken, newPassword: result.data.newPassword };
}

export function validateWithdrawalPinInput(body: unknown): { resetToken: string; newPin: string } {
  const schema = z
    .object({
      resetToken: z.string().trim().min(1).max(512),
      newPin: z.string().regex(/^\d{6}$/, 'Withdrawal PIN must be 6 digits'),
      confirmPin: z.string(),
    })
    .strict()
    .superRefine((data, ctx) => {
      if (data.newPin !== data.confirmPin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['confirmPin'],
          message: 'Withdrawal PIN confirmation does not match',
        });
      }
    });
  const result = schema.safeParse(body);
  if (!result.success) {
    const { topLevelCode, details } = mapZodIssuesToDetails(result.error.issues);
    throw new AppError(topLevelCode, 400, 'Validation failed', details);
  }
  return { resetToken: result.data.resetToken, newPin: result.data.newPin };
}
