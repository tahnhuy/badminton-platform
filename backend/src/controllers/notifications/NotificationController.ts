import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../../errors/AppError';
import {
  notificationQueryService, NotificationQueryService,
} from '../../services/notifications/NotificationQueryService';
import {
  listNotificationsQuerySchema, unreadNotificationsQuerySchema, notificationIdParamSchema,
} from '../../validation/notifications';

export { listNotificationsQuerySchema, unreadNotificationsQuerySchema, notificationIdParamSchema };

function recipientOf(req: Request): number {
  if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
  return req.user.id;
}

export class NotificationController {
  constructor(private readonly service: NotificationQueryService = notificationQueryService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as z.infer<typeof listNotificationsQuerySchema>;
      res.status(200).json(await this.service.list(recipientOf(req), query));
    } catch (err) {
      next(err);
    }
  };

  listUnread = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as z.infer<typeof unreadNotificationsQuerySchema>;
      res.status(200).json(await this.service.listUnread(recipientOf(req), query));
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as z.infer<typeof notificationIdParamSchema>;
      res.status(200).json(await this.service.get(recipientOf(req), id));
    } catch (err) {
      next(err);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as z.infer<typeof notificationIdParamSchema>;
      res.status(200).json(await this.service.markRead(recipientOf(req), id));
    } catch (err) {
      next(err);
    }
  };
}

export const notificationController = new NotificationController();
