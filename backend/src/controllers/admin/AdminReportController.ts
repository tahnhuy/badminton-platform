import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminReportService, AdminReportService } from '../../services/admin/AdminReportService';
import {
  listReportsQuerySchema,
  reportEvidenceMediaParamSchema,
  reportIdParamSchema,
  updateReportStatusBodySchema,
} from '../../validation/admin';

export { listReportsQuerySchema, reportEvidenceMediaParamSchema, reportIdParamSchema, updateReportStatusBodySchema };

function contentDisposition(kind: string, originalName: string | null): string {
  if (kind === 'IMAGE') return 'inline';
  const safe = (originalName ?? 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 255) || 'file';
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(originalName ?? 'file')}`;
}

export class AdminReportController {
  constructor(private readonly reportService: AdminReportService = adminReportService) {}

  listReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as z.infer<typeof listReportsQuerySchema>;
      const result = await this.reportService.listReports(req.user, {
        page: query.page,
        limit: query.limit,
        targetType: query.targetType,
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

  getEvidenceMedia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, mediaId } = req.params as unknown as z.infer<typeof reportEvidenceMediaParamSchema>;
      const file = await this.reportService.getEvidenceMedia(req.user, id, mediaId);
      res.status(200);
      res.setHeader('Content-Type', file.media.mimeType);
      res.setHeader('Content-Length', String(file.size));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', contentDisposition(file.media.kind, file.media.originalName));
      res.setHeader('Cache-Control', 'private, no-store');
      file.stream.on('error', streamError => {
        file.stream.destroy();
        if (!res.headersSent) next(streamError);
        else res.destroy(streamError);
      });
      file.stream.pipe(res);
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
