import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { parseCookies } from '../utils/session-cookie';
import { AppError } from '../errors/AppError';
import { logger } from '../shared/logging/logger';

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  // Only state-changing HTTP methods
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return next();
  }

  const path = req.originalUrl?.split('?')[0] || req.path;

  // Skip public register and login
  if (path.endsWith('/auth/register') || path.endsWith('/auth/login')) {
    return next();
  }

  // Parse cookies
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies.sid;

  // If no session exists, CSRF check is skipped (no login CSRF vulnerability because auth endpoints are JSON-only without CORS)
  if (!sid) {
    return next();
  }

  const reject = (reason: string): void => {
    logger.warn('CSRF token rejected', {
      code: 'AUTH_CSRF_TOKEN_INVALID',
      reason,
      method: req.method,
      path: req.originalUrl,
    });
    next(new AppError('AUTH_CSRF_TOKEN_INVALID', 403, 'CSRF token is missing or invalid'));
  };

  const cookieCsrfToken = cookies.csrf_token;
  const headerCsrfToken = req.headers['x-csrf-token'];

  if (!cookieCsrfToken || !headerCsrfToken || typeof headerCsrfToken !== 'string') {
    return reject('missing');
  }

  const cookieBuf = Buffer.from(cookieCsrfToken, 'utf-8');
  const headerBuf = Buffer.from(headerCsrfToken, 'utf-8');

  // Constant-time comparison
  if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
    return reject('mismatch');
  }

  next();
}
