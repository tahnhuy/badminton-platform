import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PASSWORD_PEPPER: z
    .string()
    .min(1, 'PASSWORD_PEPPER is required')
    .refine(
      (val) => {
        if (!base64Regex.test(val)) return false;
        try {
          const buf = Buffer.from(val, 'base64');
          return buf.length >= 32;
        } catch {
          return false;
        }
      },
      {
        message: 'PASSWORD_PEPPER must be a valid base64-encoded string decoding to at least 32 bytes',
      }
    ),
  COOKIE_SECURE: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return false;
    }),
  TRUST_PROXY: z
    .union([z.boolean(), z.string()])
    .optional()
    .default(false)
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return false;
    }),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_LOGIN_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_REGISTER_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_REGISTER_WINDOW_MINUTES: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_PASSWORD_CHANGE_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_PASSWORD_CHANGE_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
});

export type Env = z.infer<typeof envSchema> & {
  isCookieSecure: boolean;
};

export function parseEnv(rawEnv: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => {
        const path = issue.path.join('.');
        return `  - ${path}: ${issue.message}`;
      })
      .join('\n');

    console.error(`Invalid environment configuration:\n${errorDetails}`);
    process.exit(1);
  }

  const parsed = result.data;
  const isCookieSecure = parsed.NODE_ENV === 'production' ? true : parsed.COOKIE_SECURE ?? false;

  return {
    ...parsed,
    isCookieSecure,
  };
}

export const env = parseEnv();
