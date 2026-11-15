import { z } from 'zod';

// ==========================================
// Admin User Schemas
// ==========================================

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

// ==========================================
// Admin Facility & Court Schemas
// ==========================================

export const listFacilitiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(10),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'REJECTED']).optional(),
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

// ==========================================
// Admin Report Schemas (Report Management Tech Design §2; RP-01/RP-02)
// ==========================================

export const REPORT_TARGET_TYPES = ['PLAYER', 'FACILITY', 'TOURNAMENT'] as const;
export const REPORT_STATUSES = ['OPEN', 'RESOLVED'] as const;

export const listReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  target_type: z.enum(REPORT_TARGET_TYPES).optional(),
  status: z.enum(REPORT_STATUSES).optional(),
});

export const reportIdParamSchema = z.object({
  id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

// The status value itself is checked by the service so that a non-RESOLVED value
// yields ADMIN_REPORT_INVALID_STATUS. No other field (e.g. a note) is accepted.
export const updateReportStatusBodySchema = z.object({
  status: z.string(),
}).strict();
