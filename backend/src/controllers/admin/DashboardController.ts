import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { DashboardService, dashboardService } from '../../services/admin/DashboardService';
import { dashboardQuerySchema, recentActivitiesQuerySchema } from '../../validation/dashboard';

const CACHE_CONTROL = 'private, max-age=30, must-revalidate';

export class DashboardController {
  constructor(private readonly service: DashboardService = dashboardService) {}

  private applyCacheHeader(res: Response): void {
    res.setHeader('Cache-Control', CACHE_CONTROL);
  }

  kpis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { range, startDate, endDate } = req.query as unknown as z.infer<typeof dashboardQuerySchema>;
      this.applyCacheHeader(res);
      res.status(200).json({ data: await this.service.getKpis({ range, startDate, endDate }) });
    } catch (err) {
      next(err);
    }
  };

  charts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { range, startDate, endDate } = req.query as unknown as z.infer<typeof dashboardQuerySchema>;
      this.applyCacheHeader(res);
      res.status(200).json({ data: await this.service.getCharts({ range, startDate, endDate }) });
    } catch (err) {
      next(err);
    }
  };

  recentActivities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit } = req.query as unknown as z.infer<typeof recentActivitiesQuerySchema>;
      this.applyCacheHeader(res);
      res.status(200).json({ data: await this.service.getRecentActivities(limit) });
    } catch (err) {
      next(err);
    }
  };
}

export const dashboardController = new DashboardController();
