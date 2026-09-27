import express, { Express, Request, Response } from 'express';
import { env } from './shared/config/env';
import { errorHandler } from './shared/http/error-handler';
import { csrfProtection } from './shared/auth/csrf.middleware';
import authRouter from './modules/auth/auth.routes';
import skillLevelsRouter from './modules/skill-levels/skill-levels.routes';

export function createApp(): Express {
  const app = express();

  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  // Body parsing (no open cors registered)
  app.use(express.json());

  // Basic health check route
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', message: 'Badminton Platform API is running' });
  });

  // Global CSRF protection for /api/v1
  app.use('/api/v1', csrfProtection);

  // Modules routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/skill-levels', skillLevelsRouter);

  // Centralized error handler registered last
  app.use(errorHandler);

  return app;
}

export const app = createApp();
