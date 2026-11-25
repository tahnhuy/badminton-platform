import { Request, Response, NextFunction } from 'express';
import {
  validateLoginInput,
  validateChangePasswordInput,
} from '../../validation/auth';
import { authService } from '../../services/auth/AuthService';
import { skillSurveyService } from '../../services/auth/SkillSurveyService';
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
   * Starts an OTP-verified registration; no session is created yet.
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body);
      res.status(202).json({ data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/register/verify
   * Completes registration, creates the session and returns the survey result.
   */
  async verifyRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.verifyRegistration(req.body);

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
        meta: { skillSurveyResult: result.skillSurveyResult },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/register/resend
   */
  async resendRegistrationOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({ data: await authService.resendRegistrationOtp(req.body) });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/auth/skill-survey — public, no session.
   */
  async skillSurvey(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ data: await skillSurveyService.getActiveSurvey() });
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
   * POST /api/v1/auth/password/forgot
   * Always returns a challenge-shaped response for any email.
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({ data: await authService.forgotPassword(req.body) });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/password/reset/verify
   */
  async verifyPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({ data: await authService.verifyPasswordReset(req.body) });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/password/reset
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.resetPassword(req.body);
      res.status(200).json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/password/reset/resend
   */
  async resendPasswordResetOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({ data: await authService.resendPasswordResetOtp(req.body) });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/password/change/request
   * Sends the voluntary change-password OTP to the signed-in user's email.
   */
  async requestPasswordChangeOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) throw new AppError('AUTH_SESSION_INVALID', 401, 'Authentication session is invalid or missing');
      res.status(200).json({ data: await authService.requestPasswordChangeOtp(user.id) });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/password/change/verify
   */
  async verifyPasswordChangeOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) throw new AppError('AUTH_SESSION_INVALID', 401, 'Authentication session is invalid or missing');
      res.status(200).json({ data: await authService.verifyPasswordChangeOtp(user.id, req.body) });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/password/change/resend
   */
  async resendPasswordChangeOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) throw new AppError('AUTH_SESSION_INVALID', 401, 'Authentication session is invalid or missing');
      res.status(200).json({ data: await authService.resendPasswordChangeOtp(user.id, req.body) });
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

      const validated = validateChangePasswordInput(req.body);
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
