import { Request, Response, NextFunction } from 'express';
import {
  validateRegisterInput,
  validateLoginInput,
  validateChangePasswordInput,
} from '../../validation/auth';
import { authService } from '../../services/auth/AuthService';
import {
  generateCsrfToken,
  setAuthCookies,
  clearAuthCookies,
  setCsrfCookie,
  parseCookies,
} from '../../utils/session-cookie';
import { AppError } from '../../errors/AppError';

export const authController = {
  /**
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = validateRegisterInput(req.body);
      const result = await authService.register(validated);

      const csrfToken = generateCsrfToken();
      setAuthCookies(res, {
        sessionToken: result.rawToken,
        csrfToken,
        expiresAt: result.session.expiresAt,
      });

      res.status(201).json({
        data: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          requiresPasswordChange: false,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = validateLoginInput(req.body);
      const result = await authService.login(validated);

      const csrfToken = generateCsrfToken();
      setAuthCookies(res, {
        sessionToken: result.rawToken,
        csrfToken,
        expiresAt: result.session.expiresAt,
      });

      res.status(200).json({
        data: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          requiresPasswordChange: result.user.mustChangePassword,
        },
      });
    } catch (err: any) {
      if (err instanceof AppError && err.code === 'AUTH_ACCOUNT_LOCKED' && err.retryAfterSeconds) {
        res.setHeader('Retry-After', String(err.retryAfterSeconds));
      }
      next(err);
    }
  },

  /**
   * GET /api/v1/auth/me
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        throw new AppError('AUTH_SESSION_INVALID', 401, 'Authentication session is invalid or missing');
      }

      // Re-issue csrf_token cookie if missing
      const cookies = parseCookies(req.headers.cookie);
      if (!cookies.csrf_token && req.authSession) {
        const csrfToken = generateCsrfToken();
        setCsrfCookie(res, csrfToken, req.authSession.expiresAt);
      }

      res.status(200).json({
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          requiresPasswordChange: user.mustChangePassword ?? false,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cookies = parseCookies(req.headers.cookie);
      await authService.logout(cookies.sid);
      clearAuthCookies(res);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/password/change
   */
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        throw new AppError('AUTH_SESSION_INVALID', 401, 'Authentication session is invalid or missing');
      }

      const validated = validateChangePasswordInput(req.body, user.email);
      await authService.changePassword(user.id, validated);

      res.status(200).json({
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          requiresPasswordChange: false,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
