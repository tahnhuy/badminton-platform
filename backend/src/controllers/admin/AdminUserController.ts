import { Request, Response, NextFunction } from 'express';
import { adminUserService, AdminUserService } from '../../services/admin/AdminUserService';
import { UnauthorizedError } from '../../errors/AppError';
import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().optional(),
  role: z.enum(['PLAYER', 'COURT_OWNER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
  sort: z.enum(['newest', 'oldest', 'name_asc', 'name_desc']).optional(),
});

export const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateStatusBodySchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
});

export const bulkStatusBodySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
});

export const bulkDeleteBodySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export const setPasswordBodySchema = z.object({
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const createUserBodySchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự trở lên'),
  role: z.enum(['PLAYER', 'COURT_OWNER', 'ADMIN']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional().default('ACTIVE'),
  fullName: z.string().optional(),
  skillLevelId: z.number().int().optional(),
  avatarUrl: z.string().optional(),
  businessName: z.string().optional(),
  phone: z.string().optional(),
});

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
      const result = await this.userService.createUser(body);
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
      const result = await this.userService.setUserPassword(id, new_password);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const adminUserController = new AdminUserController();
