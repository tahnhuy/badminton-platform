import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import { db, users } from '../db';
import { eq, and, isNull } from 'drizzle-orm';
import '../types/auth';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user) {
      if (req.user.status !== 'ACTIVE') {
        throw new UnauthorizedError('Account is not active', 'AUTH_SESSION_INVALID');
      }
      return next();
    }

    // Support X-User-Id header (for testing and direct identification)
    const headerUserId = req.headers['x-user-id'];
    if (headerUserId) {
      const userId = Number(headerUserId);
      if (!isNaN(userId)) {
        const found = await db
          .select({
            id: users.id,
            email: users.email,
            role: users.role,
            status: users.status,
            deletedAt: users.deletedAt,
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
            role: u.role,
            status: u.status,
          };
          return next();
        }
      }
    }

    // Support X-User-Email header
    const headerUserEmail = req.headers['x-user-email'];
    if (headerUserEmail && typeof headerUserEmail === 'string') {
      const found = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          status: users.status,
          deletedAt: users.deletedAt,
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
          role: u.role,
          status: u.status,
        };
        return next();
      }
    }

    // [TEMP AUTH BYPASS] The Auth module is not implemented yet.
    // Fall back to an active Admin so the Admin dashboard is reachable without signing in.
    // Remove this block and re-enable `requireRole('ADMIN')` on the admin routes once Auth lands.
    const fallbackAdmin = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
      })
      .from(users)
      .where(and(eq(users.role, 'ADMIN'), eq(users.status, 'ACTIVE'), isNull(users.deletedAt)))
      .limit(1);

    if (fallbackAdmin.length > 0) {
      const u = fallbackAdmin[0];
      req.user = {
        id: u.id,
        email: u.email,
        role: u.role,
        status: u.status,
      };
      return next();
    }

    req.user = {
      id: 1,
      email: 'admin@smashpro.vn',
      role: 'ADMIN',
      status: 'ACTIVE',
    };
    return next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Access denied', 'AUTH_FORBIDDEN_ROLE'));
    }

    next();
  };
}
