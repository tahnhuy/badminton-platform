import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/http/app-error';
import {
  loginRateLimiter,
  registerRateLimiter,
  passwordChangeRateLimiter,
} from '../../shared/http/rate-limit';
import { authenticate } from '../../shared/auth/authenticate.middleware';
import { authController } from './auth.controller';

const router = Router();

// JSON-only guard: requests with body must have Content-Type: application/json (except /logout)
router.use((req: Request, _res: Response, next: NextFunction) => {
  const method = req.method.toUpperCase();
  if (req.path === '/logout') {
    return next();
  }
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return next(new AppError('VALIDATION_FAILED', 400, 'Content-Type must be application/json'));
    }
  }
  next();
});

router.post('/register', registerRateLimiter, authController.register);
router.post('/login', loginRateLimiter, authController.login);
router.get('/me', authenticate, authController.me);
router.post('/logout', authController.logout);
router.post('/password/change', authenticate, passwordChangeRateLimiter, authController.changePassword);

export default router;

