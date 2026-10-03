import rateLimit, { MemoryStore } from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../shared/config/env';
import { logger } from '../shared/logging/logger';

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
    handler: (req: Request, res: Response, _next, options) => {
      const resetTime = (req as unknown as { rateLimit?: { resetTime?: Date | number } }).rateLimit
        ?.resetTime;
      const resetMs = resetTime ? new Date(resetTime).getTime() : Date.now() + options.windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));

      res.setHeader('Retry-After', String(retryAfterSeconds));
      logger.warn('Rate limit exceeded', {
        code: 'AUTH_RATE_LIMITED',
        method: req.method,
        path: req.originalUrl,
      });

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
