import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminReportService, AdminReportService } from '../../services/admin/AdminReportService';
import {
  listReportsQuerySchema,
  reportIdParamSchema,
  updateReportStatusBodySchema,
} from '../../validation/admin';

export { listReportsQuerySchema, reportIdParamSchema, updateReportStatusBodySchema };

export class AdminReportController {
  constructor(private readonly reportService: AdminReportService = adminReportService) {}

  listReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as z.infer<typeof listReportsQuerySchema>;
      const result = await this.reportService.listReports(req.user, {
        page: query.page,
        limit: query.limit,
        targetType: query.target_type,
        status: query.status,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as z.infer<typeof reportIdParamSchema>;
      res.status(200).json(await this.reportService.getReport(req.user, id));
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as z.infer<typeof reportIdParamSchema>;
      const { status } = req.body as z.infer<typeof updateReportStatusBodySchema>;
      res.status(200).json(await this.reportService.updateStatus(req.user, id, status));
    } catch (err) {
      next(err);
    }
  };
}

export const adminReportController = new AdminReportController();
