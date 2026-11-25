import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { validatePrivateUploadsRoot } from '../storage/private-root';
import { uploadsRoot } from '../storage/avatar-storage';

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
  PAYMENT_PROVIDER: z.enum(['WALLET', 'MOCK', 'VNPAY', 'SEPAY']).default('WALLET'),
  VNPAY_TMN_CODE: z.string().optional().default(''),
  VNPAY_HASH_SECRET: z.string().optional().default(''),
  VNPAY_PAYMENT_URL: z.string().optional().default('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
  VNPAY_RETURN_URL: z.string().optional().default('http://localhost:5173/payment/vnpay-return'),
  VNPAY_IPN_URL: z.string().optional().default('http://localhost:3000/api/v1/payments/vnpay/webhook'),
  SEPAY_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  SEPAY_MERCHANT_ID: z.string().optional().default(''),
  SEPAY_SECRET_KEY: z.string().optional().default(''),
  SEPAY_CHECKOUT_URL: z.string().optional().default('https://pay-sandbox.sepay.vn/v1/checkout/init'),
  SEPAY_API_BASE_URL: z.string().optional().default('https://pgapi-sandbox.sepay.vn'),
  SEPAY_IPN_SECRET: z.string().optional().default(''),
  SEPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  SEPAY_BANK_CODE: z.string().optional().default(''),
  SEPAY_BANK_ACCOUNT: z.string().optional().default(''),
  SEPAY_ACCOUNT_NAME: z.string().optional().default(''),
  SEPAY_QR_BASE_URL: z.string().optional().default('https://vietqr.app/img'),

  SEPAY_SUCCESS_URL: z.string().optional().default('http://localhost:5173/wallet?payment=success'),
  SEPAY_ERROR_URL: z.string().optional().default('http://localhost:5173/wallet?payment=error'),
  SEPAY_CANCEL_URL: z.string().optional().default('http://localhost:5173/wallet?payment=cancel'),
  REFUND_ENABLED: z
    .union([z.boolean(), z.string()])
    .optional()
    .default('true')
    .transform((val) => (typeof val === 'boolean' ? val : val.toLowerCase() === 'true')),
  REFUND_PROCESSING_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(1440),
  OWNER_EARNING_JOB_ENABLED: z
    .union([z.boolean(), z.string()])
    .optional()
    .default('true')
    .transform((val) => (typeof val === 'boolean' ? val : val.toLowerCase() === 'true')),
  // Social Tech Design §7.4 (SOC-02): required in every environment; checked below.
  PRIVATE_UPLOADS_DIR: z.string({ message: 'PRIVATE_UPLOADS_DIR is required' }).min(1, 'PRIVATE_UPLOADS_DIR is required'),

  // Email OTP / withdrawal PIN (email-otp-and-withdrawal-pin-plan §6-§7).
  // Production requires real secrets and provider configuration; dev/test may
  // omit them and fall back to non-production defaults/fake adapters.
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default(''),
  OTP_HMAC_SECRET: z.string().optional().default(''),
  WITHDRAWAL_PIN_PEPPER: z.string().optional().default(''),
}).superRefine((value, ctx) => {
  if (value.PRIVATE_UPLOADS_DIR) {
    for (const message of validatePrivateUploadsRoot(value.PRIVATE_UPLOADS_DIR, [uploadsRoot])) {
      ctx.addIssue({ code: 'custom', path: ['PRIVATE_UPLOADS_DIR'], message });
    }
  }

  if (value.NODE_ENV !== 'production') return;
  const required: [keyof typeof value, string][] = [
    ['RESEND_API_KEY', 'RESEND_API_KEY is required in production'],
    ['EMAIL_FROM', 'EMAIL_FROM is required in production'],
    ['OTP_HMAC_SECRET', 'OTP_HMAC_SECRET is required in production'],
    ['WITHDRAWAL_PIN_PEPPER', 'WITHDRAWAL_PIN_PEPPER is required in production'],
  ];
  for (const [key, message] of required) {
    if (!String(value[key] ?? '').trim()) {
      ctx.addIssue({ code: 'custom', path: [key], message });
    }
  }
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
  if (parsed.NODE_ENV !== 'production') {
    // Dev/test only: derive dedicated secrets so flows work without extra local config.
    if (!parsed.OTP_HMAC_SECRET) parsed.OTP_HMAC_SECRET = `${parsed.PASSWORD_PEPPER}:otp-hmac`;
    if (!parsed.WITHDRAWAL_PIN_PEPPER) parsed.WITHDRAWAL_PIN_PEPPER = `${parsed.PASSWORD_PEPPER}:withdrawal-pin`;
  }
  const isCookieSecure = parsed.NODE_ENV === 'production' ? true : parsed.COOKIE_SECURE ?? false;

  return {
    ...parsed,
    isCookieSecure,
  };
}

export const env = parseEnv();
