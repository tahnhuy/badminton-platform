import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { tournamentConfig } from '../shared/config/tournament-config';

/** Gate every interactive tournament write, including teams and Admin actions; reads stay available. */
export async function requireTournamentEnabled(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  try {
    if (!(await tournamentConfig.get()).enabled) {
      throw new AppError('TOURNAMENT_DISABLED', 409, 'Tournaments are temporarily unavailable');
    }
    next();
  } catch (error) {
    next(error);
  }
}
