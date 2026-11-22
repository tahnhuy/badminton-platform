import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../../errors/AppError';
import { reportSubmissionService, ReportSubmissionService } from '../../services/reports/ReportSubmissionService';
import { createReportBodySchema } from '../../validation/reports';

export { createReportBodySchema };

export class ReportController {
  constructor(private readonly service: ReportSubmissionService = reportSubmissionService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
      const body = req.body as z.infer<typeof createReportBodySchema>;
      const result = await this.service.create({ id: req.user.id, role: req.user.role }, body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const reportController = new ReportController();
