import { Request, Response, NextFunction } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { db, users } from '../db';
import { env } from '../shared/config/env';
import { authenticate as authenticateSession } from '../shared/auth/authenticate.middleware';
import { requireRole } from '../shared/auth/authorize.middleware';
import { UnauthorizedError } from '../errors/AppError';

export { requireRole };

/**
 * Test-only identity resolution.
 *
 * The admin API is protected by the real session-based authentication in
 * `shared/auth/authenticate.middleware`. Integration tests would otherwise need to
 * create a full session to exercise every endpoint, so during `NODE_ENV=test`
 * (and only when `ALLOW_TEST_AUTH=true` is explicitly set by the test harness) we
 * allow identity to be provided via the `x-user-id` / `x-user-email` headers.
 *
 * There is deliberately no anonymous fallback: a request without a resolvable
 * test identity is rejected. This branch NEVER runs in development or production.
 */
async function resolveTestUser(req: Request, next: NextFunction): Promise<void> {
  try {
    if (req.user) {
      return next();
    }

    const headerUserId = req.headers['x-user-id'];
    if (headerUserId) {
      const userId = Number(headerUserId);
      if (!isNaN(userId)) {
        const found = await db
          .select({
            id: users.id,
            email: users.email,
            role: users.role,
            mustChangePassword: users.mustChangePassword,
            deletedAt: users.deletedAt,
            status: users.status,
          })
          .from(users)
          .where(and(eq(users.id, userId), isNull(users.deletedAt)))
          .limit(1);

        if (found.length > 0) {
          const u = found[0];
          if (u.status !== 'ACTIVE') {
            throw new UnauthorizedError('Account is not active', 'AUTH_SESSION_INVALID');
          }
          req.user = {
            id: u.id,
            email: u.email,
            role: u.role as 'PLAYER' | 'COURT_OWNER' | 'ADMIN',
            mustChangePassword: u.mustChangePassword,
          };
          return next();
        }
      }
    }

    const headerUserEmail = req.headers['x-user-email'];
    if (headerUserEmail && typeof headerUserEmail === 'string') {
      const found = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          mustChangePassword: users.mustChangePassword,
          deletedAt: users.deletedAt,
          status: users.status,
        })
        .from(users)
        .where(and(eq(users.email, headerUserEmail.trim().toLowerCase()), isNull(users.deletedAt)))
        .limit(1);

      if (found.length > 0) {
        const u = found[0];
        if (u.status !== 'ACTIVE') {
          throw new UnauthorizedError('Account is not active', 'AUTH_SESSION_INVALID');
        }
        req.user = {
          id: u.id,
          email: u.email,
          role: u.role as 'PLAYER' | 'COURT_OWNER' | 'ADMIN',
          mustChangePassword: u.mustChangePassword,
        };
        return next();
      }
    }

    throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
  } catch (err) {
    next(err);
  }
}

function isTestAuthEnabled(): boolean {
  return env.NODE_ENV === 'test' && process.env.ALLOW_TEST_AUTH === 'true';
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (isTestAuthEnabled()) {
    return resolveTestUser(req, next);
  }
  return authenticateSession(req, res, next);
}
