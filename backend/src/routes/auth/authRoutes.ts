import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../../errors/AppError';
import {
  loginRateLimiter,
  registerRateLimiter,
  passwordChangeRateLimiter,
} from '../../middleware/rate-limit.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { authController } from '../../controllers/auth/AuthController';

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

router.get('/skill-survey', authController.skillSurvey);
router.post('/register', registerRateLimiter, authController.register);
router.post('/login', loginRateLimiter, authController.login);
router.get('/me', authenticate, authController.me);
router.post('/logout', authController.logout);
router.post('/password/change', authenticate, passwordChangeRateLimiter, authController.changePassword);

export default router;
