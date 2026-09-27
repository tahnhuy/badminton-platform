import { Request, Response, NextFunction } from 'express';
import { adminGlobalSearchService } from '../../services/admin/AdminGlobalSearchService';

export class AdminGlobalSearchController {
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const results = await adminGlobalSearchService.search(q);

      res.status(200).json({ data: results });
    } catch (error) {
      next(error);
    }
  }
}

export const adminGlobalSearchController = new AdminGlobalSearchController();
