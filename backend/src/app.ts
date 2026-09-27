import express, { Express, Request, Response } from 'express';
import { env } from './shared/config/env';
import { errorHandler } from './shared/http/error-handler';

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

  // Centralized error handler registered last
  app.use(errorHandler);

  return app;
}

export const app = createApp();
