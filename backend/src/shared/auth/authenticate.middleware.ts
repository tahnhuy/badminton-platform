import { Request, Response, NextFunction } from 'express';
import { parseCookies, clearAuthCookies } from './session-cookie';
import { authRepository } from '../../modules/auth/auth.repository';
import { AppError } from '../http/app-error';
import { SystemRole } from './types';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
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
