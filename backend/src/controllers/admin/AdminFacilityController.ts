import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminFacilityService, AdminFacilityService } from '../../services/admin/AdminFacilityService';
import { UnauthorizedError } from '../../errors/AppError';
import {
  listFacilitiesQuerySchema,
  facilityIdParamSchema,
  courtParamsSchema,
  updateFacilityStatusBodySchema,
  createFacilityBodySchema,
} from '../../validation/admin';

export {
  listFacilitiesQuerySchema,
  facilityIdParamSchema,
  courtParamsSchema,
  updateFacilityStatusBodySchema,
  createFacilityBodySchema,
};

export class AdminFacilityController {
  constructor(private readonly facilityService: AdminFacilityService = adminFacilityService) {}

  private getActorId(req: Request): number {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
    }
    return req.user.id;
  }

  listFacilities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as z.infer<typeof listFacilitiesQuerySchema>;
      const result = await this.facilityService.listFacilities(query);

      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  getFacilityById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as z.infer<typeof facilityIdParamSchema>;
      const facility = await this.facilityService.getFacilityById(id);

      res.status(200).json({
        data: facility,
      });
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = this.getActorId(req);
      const { id } = req.params as unknown as z.infer<typeof facilityIdParamSchema>;
      const { status } = req.body as z.infer<typeof updateFacilityStatusBodySchema>;

      const updated = await this.facilityService.updateFacilityStatus(id, status, actorId);

      res.status(200).json({
        data: updated,
        message: `Cơ sở đã được chuyển sang trạng thái ${status}`,
      });
    } catch (err) {
      next(err);
    }
  };

  softDelete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = this.getActorId(req);
      const { id } = req.params as unknown as z.infer<typeof facilityIdParamSchema>;

      await this.facilityService.deleteFacility(id, actorId);

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  updateCourtStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = this.getActorId(req);
      const { facilityId, courtId } = req.params as unknown as z.infer<typeof courtParamsSchema>;
      const { status } = req.body as z.infer<typeof updateFacilityStatusBodySchema>;

      const updated = await this.facilityService.updateCourtStatus(facilityId, courtId, status, actorId);

      res.status(200).json({
        data: updated,
        message: `Sân đã được chuyển sang trạng thái ${status}`,
      });
    } catch (err) {
      next(err);
    }
  };

  deleteCourt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = this.getActorId(req);
      const { facilityId, courtId } = req.params as unknown as z.infer<typeof courtParamsSchema>;

      await this.facilityService.deleteCourt(facilityId, courtId, actorId);

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  createFacility = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.getActorId(req);
      const body = req.body as z.infer<typeof createFacilityBodySchema>;
      const created = await this.facilityService.createFacility(body);

      res.status(201).json({
        data: created,
        message: 'Khởi tạo cơ sở và cụm sân thành công',
      });
    } catch (err) {
      next(err);
    }
  };
}

export const adminFacilityController = new AdminFacilityController();
