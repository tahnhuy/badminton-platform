import express, { Express, Request, Response } from 'express';
import { env } from './shared/config/env';
import { errorHandler } from './shared/http/error-handler';
import { csrfProtection } from './shared/auth/csrf.middleware';
import authRouter from './modules/auth/auth.routes';
import skillLevelsRouter from './modules/skill-levels/skill-levels.routes';
import adminUserRoutes from './routes/admin/adminUserRoutes';
import adminFacilityRoutes from './routes/admin/adminFacilityRoutes';
import adminGlobalSearchRoutes from './routes/admin/adminGlobalSearchRoutes';
import courtRoutes from './routes/booking/courtRoutes';
import bookingRoutes from './routes/booking/bookingRoutes';

export function createApp(): Express {
  const app = express();

  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  // Body parsing (JSON only; URL-encoded parsing intentionally omitted for auth routes)
  app.use(express.json());

  // Basic health check route
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', message: 'Badminton Platform API is running' });
  });

  // Global CSRF protection for /api/v1
  app.use('/api/v1', csrfProtection);

  // Auth & platform modules
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/skill-levels', skillLevelsRouter);

  // Admin modules
  app.use('/api/v1/admin/users', adminUserRoutes);
  app.use('/api/v1/admin/facilities', adminFacilityRoutes);
  app.use('/api/v1/admin/global-search', adminGlobalSearchRoutes);

  // Public court discovery (booking read-path)
  app.use('/api/v1/courts', courtRoutes);
  app.use('/api/v1/bookings', bookingRoutes);

  // Centralized error handler registered last
  app.use(errorHandler);

  return app;
}

export const app = createApp();

export default app;
