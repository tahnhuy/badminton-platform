import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminConfigService, AdminConfigService } from '../../services/admin/AdminConfigService';
import { UnauthorizedError } from '../../errors/AppError';
import {
  configKeyParamSchema,
  listConfigsQuerySchema,
  updateConfigBodySchema,
} from '../../validation/admin-config';

export { configKeyParamSchema, listConfigsQuerySchema, updateConfigBodySchema };

export class AdminConfigController {
  constructor(private readonly service: AdminConfigService = adminConfigService) {}

  private getActorId(req: Request): number {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
    }
    return req.user.id;
  }

  listConfigs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as z.infer<typeof listConfigsQuerySchema>;
      res.status(200).json(await this.service.listConfigs(query));
    } catch (err) {
      next(err);
    }
  };

  getConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { configKey } = req.params as unknown as z.infer<typeof configKeyParamSchema>;
      res.status(200).json({ data: await this.service.getConfig(configKey) });
    } catch (err) {
      next(err);
    }
  };

  updateConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { configKey } = req.params as unknown as z.infer<typeof configKeyParamSchema>;
      const { value } = req.body as z.infer<typeof updateConfigBodySchema>;
      res.status(200).json({ data: await this.service.updateConfig(configKey, value, this.getActorId(req)) });
    } catch (err) {
      next(err);
    }
  };
}

export const adminConfigController = new AdminConfigController();
