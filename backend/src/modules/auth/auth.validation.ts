import { z } from 'zod';
import { AppError } from '../../shared/http/app-error';

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

  if (codePoints < 8 || codePoints > 64) {
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
    skillLevelCode: z
      .string()
      .refine((val) => typeof val === 'string' && val.trim().length > 0, {
        params: { errorCode: 'AUTH_INVALID_SKILL_LEVEL' },
        message: 'skillLevelCode must be a non-empty string',
      }),
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
  })
  .strict();

export function mapZodIssuesToDetails(issues: z.ZodIssue[]): {
  topLevelCode: string;
  details: FieldErrorDetail[];
} {
  const details: FieldErrorDetail[] = [];
  const seenFields = new Set<string>();

  for (const issue of issues) {
    const field = issue.path.length > 0 ? String(issue.path[0]) : 'body';
    if (seenFields.has(field)) {
      continue;
    }
    seenFields.add(field);

    let code = 'VALIDATION_FAILED';
    if (issue.code === z.ZodIssueCode.custom) {
      if (field === 'skillLevelCode') {
        code = 'AUTH_INVALID_SKILL_LEVEL';
      } else if (field === 'password' || field === 'newPassword') {
        code = 'AUTH_PASSWORD_POLICY_VIOLATION';
      }
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

export function validateRegisterInput(body: unknown): z.infer<typeof registerSchema> {
  const result = registerSchema.safeParse(body);
  if (!result.success) {
    const { topLevelCode, details } = mapZodIssuesToDetails(result.error.issues);
    throw new AppError(topLevelCode, 400, 'Validation failed', details);
  }
  return {
    ...result.data,
    email: result.data.email.trim().toLowerCase(),
    fullName: result.data.fullName.trim(),
    skillLevelCode: result.data.skillLevelCode.trim(),
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
