import rateLimit, { MemoryStore } from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../config/env';

export const loginStore = new MemoryStore();
export const registerStore = new MemoryStore();
export const passwordChangeStore = new MemoryStore();

function createRateLimiter(windowMinutes: number, maxRequests: number, store: MemoryStore) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code: 'AUTH_RATE_LIMITED',
          message: 'Too many requests, please try again later',
          details: [],
        },
      });
    },
  });
}

export const loginRateLimiter = createRateLimiter(
  env.RATE_LIMIT_LOGIN_WINDOW_MINUTES,
  env.RATE_LIMIT_LOGIN_MAX,
  loginStore
);

export const registerRateLimiter = createRateLimiter(
  env.RATE_LIMIT_REGISTER_WINDOW_MINUTES,
  env.RATE_LIMIT_REGISTER_MAX,
  registerStore
);

export const passwordChangeRateLimiter = createRateLimiter(
  env.RATE_LIMIT_PASSWORD_CHANGE_WINDOW_MINUTES,
  env.RATE_LIMIT_PASSWORD_CHANGE_MAX,
  passwordChangeStore
);

export function resetRateLimitStores(): void {
  loginStore.resetAll();
  registerStore.resetAll();
  passwordChangeStore.resetAll();
}

