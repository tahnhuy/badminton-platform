import express, { Express, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { errorHandler } from '../middleware/error.middleware';

export function createAuthTestApp(): Express {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('createAuthTestApp must only be called when NODE_ENV=test');
  }

  const app = express();
  app.use(express.json());

  app.get('/test/protected', authenticate, (req: Request, res: Response) => {
    res.status(200).json({ data: req.user });
  });

  app.get('/test/player-only', authenticate, requireRole('PLAYER'), (req: Request, res: Response) => {
    res.status(200).json({ data: { message: 'Player access granted', user: req.user } });
  });

  app.get('/test/owner-only', authenticate, requireRole('COURT_OWNER'), (req: Request, res: Response) => {
    res.status(200).json({ data: { message: 'Owner access granted', user: req.user } });
  });

  app.get('/test/admin-only', authenticate, requireRole('ADMIN'), (req: Request, res: Response) => {
    res.status(200).json({ data: { message: 'Admin access granted', user: req.user } });
  });

  // Centralized error handler registered last
  app.use(errorHandler);

  return app;
}
