import { Request, Response, NextFunction } from 'express';
import { adminFacilityService, AdminFacilityService } from '../../services/admin/AdminFacilityService';
import { UnauthorizedError } from '../../errors/AppError';
import { z } from 'zod';

export const listFacilitiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(10),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  city: z.string().optional(),
  bwfStandard: z.string().optional(),
  sort: z.enum(['courtCount_desc', 'courtCount_asc', 'newest', 'oldest', 'name_asc', 'name_desc']).optional(),
});

export const facilityIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const courtParamsSchema = z.object({
  facilityId: z.coerce.number().int().positive(),
  courtId: z.coerce.number().int().positive(),
});

export const updateFacilityStatusBodySchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: z
    .enum(['PCCC_EXPIRED', 'LIGHTING_STANDARD_FAILED', 'TOS_VIOLATION', 'DISPUTE_INVESTIGATION'])
    .optional(),
  note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
});

export const createFacilityBodySchema = z.object({
  name: z.string().min(2, 'Tên cơ sở tối thiểu 2 ký tự'),
  address: z.string().min(5, 'Địa chỉ chi tiết tối thiểu 5 ký tự'),
  city: z.string().min(2, 'Vui lòng chọn hoặc nhập Tỉnh / Thành phố'),
  district: z.string().optional(),
  ward: z.string().optional(),
  phone: z.string().optional(),
  description: z.string().optional(),
  ownerName: z.string().min(2, 'Họ tên chủ sân tối thiểu 2 ký tự'),
  ownerPhone: z.string().min(8, 'Số điện thoại chủ sân tối thiểu 8 chữ số'),
  ownerEmail: z.string().email('Email chủ sân không đúng định dạng'),
  courtCount: z.coerce
    .number()
    .int('Số lượng sân phải là số nguyên')
    .min(1, 'Số lượng sân tối thiểu là 1')
    .max(50, 'Số lượng sân tối đa là 50')
    .default(4),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
});

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
