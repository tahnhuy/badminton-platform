import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminUserService, AdminUserService } from '../../services/admin/AdminUserService';
import { UnauthorizedError } from '../../errors/AppError';
import {
  listUsersQuerySchema,
  userIdParamSchema,
  updateStatusBodySchema,
  bulkStatusBodySchema,
  bulkDeleteBodySchema,
  setPasswordBodySchema,
  createUserBodySchema,
} from '../../validation/admin';

export {
  listUsersQuerySchema,
  userIdParamSchema,
  updateStatusBodySchema,
  bulkStatusBodySchema,
  bulkDeleteBodySchema,
  setPasswordBodySchema,
  createUserBodySchema,
};

export class AdminUserController {
  constructor(private readonly userService: AdminUserService = adminUserService) {}

  private getActorId(req: Request): number {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
    }
    return req.user.id;
  }

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as z.infer<typeof listUsersQuerySchema>;
      const result = await this.userService.listUsers(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof createUserBodySchema>;
      const result = await this.userService.createUser(body, this.getActorId(req));
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as z.infer<typeof userIdParamSchema>;
      const result = await this.userService.getUserById(id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as z.infer<typeof userIdParamSchema>;
      const { status } = req.body as z.infer<typeof updateStatusBodySchema>;
      const actorAdminId = this.getActorId(req);
      const result = await this.userService.updateUserStatus(id, status, actorAdminId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  bulkUpdateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ids, status } = req.body as z.infer<typeof bulkStatusBodySchema>;
      const actorAdminId = this.getActorId(req);
      const result = await this.userService.bulkUpdateStatus(ids, status, actorAdminId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  softDelete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as z.infer<typeof userIdParamSchema>;
      const actorAdminId = this.getActorId(req);
      await this.userService.softDeleteUser(id, actorAdminId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  bulkSoftDelete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ids } = req.body as z.infer<typeof bulkDeleteBodySchema>;
      const actorAdminId = this.getActorId(req);
      const result = await this.userService.bulkSoftDelete(ids, actorAdminId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  setPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as z.infer<typeof userIdParamSchema>;
      const { new_password } = req.body as z.infer<typeof setPasswordBodySchema>;
      const result = await this.userService.setUserPassword(id, new_password, this.getActorId(req));
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const adminUserController = new AdminUserController();
