import { Request, Response, NextFunction } from 'express';
import { skillLevelsRepository } from './skill-levels.repository';

export const skillLevelsController = {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await skillLevelsRepository.listAll();
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },
};
