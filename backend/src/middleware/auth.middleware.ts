import { Request, Response, NextFunction } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { db, users } from '../db';
import { env } from '../shared/config/env';
import { parseCookies, clearAuthCookies } from '../utils/session-cookie';
import { authRepository } from '../repositories/auth/AuthRepository';
import { AppError, UnauthorizedError } from '../errors/AppError';

export type SystemRole = 'PLAYER' | 'COURT_OWNER' | 'ADMIN';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: SystemRole;
  mustChangePassword?: boolean;
}

export interface AuthenticatedSession {
  id: number;
  expiresAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      authSession?: AuthenticatedSession;
    }
  }
}

export function requireRole(...roles: SystemRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('AUTH_FORBIDDEN_ROLE', 403, 'Access denied for the current user role'));
    }
    next();
  };
}

/**
 * Real session-based authentication handler.
 */
async function authenticateSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies.sid;

  if (!sid) {
    clearAuthCookies(res);
    return next(new AppError('AUTH_SESSION_INVALID', 401, 'Authentication session is invalid or missing'));
  }

  try {
    const active = await authRepository.findActiveSessionWithUser(sid);

    if (!active) {
      clearAuthCookies(res);
      return next(new AppError('AUTH_SESSION_INVALID', 401, 'Authentication session is invalid or revoked'));
    }

    const { session, user } = active;
    const now = new Date();

    // Check absolute expiration
    if (session.expiresAt <= now) {
      clearAuthCookies(res);
      return next(new AppError('AUTH_SESSION_INVALID', 401, 'Authentication session has expired'));
    }

    // Check idle timeout
    const idleDeadline = new Date(session.lastSeenAt.getTime() + session.idleTimeoutMinutes * 60 * 1000);
    if (idleDeadline <= now) {
      clearAuthCookies(res);
      return next(new AppError('AUTH_SESSION_EXPIRED', 401, 'Authentication session expired due to inactivity'));
    }

    // Check account status and soft delete
    if (user.deletedAt !== null || user.status !== 'ACTIVE') {
      clearAuthCookies(res);
      return next(new AppError('AUTH_SESSION_INVALID', 401, 'Account is not in good standing'));
    }

    // Check forced password change requirement
    if (user.mustChangePassword) {
      const originalPath = req.originalUrl?.split('?')[0] || req.path;
      const isAllowedEndpoint =
        (req.method === 'GET' && originalPath.endsWith('/auth/me')) ||
        (req.method === 'POST' && originalPath.endsWith('/auth/password/change')) ||
        (req.method === 'POST' && originalPath.endsWith('/auth/logout'));

      if (!isAllowedEndpoint) {
        return next(
          new AppError('AUTH_PASSWORD_CHANGE_REQUIRED', 403, 'Password change required before accessing other resources')
        );
      }
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as SystemRole,
      mustChangePassword: user.mustChangePassword,
    };

    req.authSession = {
      id: session.id,
      expiresAt: session.expiresAt,
    };

    // Touch session last seen timestamp (if older than 60s)
    authRepository.touchSessionLastSeen(session.id, session.lastSeenAt).catch(() => {});

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Test-only identity resolution.
 *
 * During NODE_ENV=test (and only when ALLOW_TEST_AUTH=true is explicitly set by the test harness)
 * we allow identity to be provided via the x-user-id / x-user-email headers.
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
          req.user = activeTestIdentity(found[0]);
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
        req.user = activeTestIdentity(found[0]);
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
  if (isTestAuthEnabled() && (req.headers['x-user-id'] || req.headers['x-user-email'])) {
    return resolveTestUser(req, next);
  }
  return authenticateSession(req, res, next);
}

/**
 * Identifies the viewer when a session (or, in tests, an identity header) is present,
 * and lets visitors through otherwise. An invalid or expired session is treated as a
 * visitor instead of failing the request (public read endpoints, Tournament §3.1).
 */
export async function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const hasTestIdentity = isTestAuthEnabled() && (req.headers['x-user-id'] || req.headers['x-user-email']);
  if (!hasTestIdentity && !parseCookies(req.headers.cookie).sid) return next();
  await authenticate(req, res, (err?: unknown) => {
    if (err && (err as { statusCode?: number }).statusCode === 401) {
      req.user = undefined;
      return next();
    }
    return next(err as Error | undefined);
  });
}

function activeTestIdentity(u: Pick<typeof users.$inferSelect, 'id' | 'email' | 'role' | 'mustChangePassword' | 'status'>) {
  if (u.status !== 'ACTIVE') {
    throw new UnauthorizedError('Account is not active', 'AUTH_SESSION_INVALID');
  }
  return {
    id: u.id,
    email: u.email,
    role: u.role as SystemRole,
    mustChangePassword: u.mustChangePassword,
  };
}
