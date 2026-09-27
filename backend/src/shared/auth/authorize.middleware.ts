import { Request, Response, NextFunction } from 'express';
import { AppError } from '../http/app-error';
import { SystemRole } from './types';

export function requireRole(...roles: SystemRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('AUTH_FORBIDDEN_ROLE', 403, 'Access denied for the current user role'));
    }
    next();
  };
}
