import { z } from 'zod';

/** Court Owner partnership requests (partnership-request PRD §8, Tech Design §5). */

export const OWNER_REQUEST_STATUSES = ['PENDING', 'CONTACTED', 'APPROVED', 'REJECTED'] as const;
export type OwnerRequestStatus = (typeof OWNER_REQUEST_STATUSES)[number];

/** Vietnamese mobile number; accepts +84 / 84 / 0 prefixes and spaces, dots or dashes. */
export function normalizeVietnamesePhone(raw: string): string | null {
  const digits = raw.replace(/[\s.-]/g, '');
  const local = digits.startsWith('+84') ? `0${digits.slice(3)}` : digits.startsWith('84') && digits.length === 11 ? `0${digits.slice(2)}` : digits;
  return /^0(3|5|7|8|9)\d{8}$/.test(local) ? local : null;
}

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} cần ít nhất ${min} ký tự`).max(max, `${label} tối đa ${max} ký tự`);

export const phoneSchema = z.string().transform((value, ctx) => {
  const phone = normalizeVietnamesePhone(value);
  if (!phone) {
    ctx.addIssue({ code: 'custom', message: 'Số điện thoại không hợp lệ' });
    return z.NEVER;
  }
  return phone;
});

export const ownerRequestBodySchema = z.object({
  contactName: text(2, 100, 'Họ tên'),
  email: z.string().trim().toLowerCase().max(254, 'Email tối đa 254 ký tự').email('Email không hợp lệ'),
  phone: phoneSchema,
  facilityName: text(2, 150, 'Tên cơ sở'),
  addressLine: text(5, 255, 'Địa chỉ'),
  district: text(2, 100, 'Quận/huyện'),
  city: text(2, 100, 'Tỉnh/thành phố'),
  expectedCourts: z.coerce.number().int('Số sân phải là số nguyên').min(1, 'Ít nhất 1 sân').max(50, 'Tối đa 50 sân'),
  note: z.string().trim().max(1000, 'Ghi chú tối đa 1000 ký tự').optional().transform(value => value || undefined),
  consent: z.literal(true, { error: 'Bạn cần đồng ý để SmashPro liên hệ' }),
  /** Hidden honeypot field: people leave it empty. */
  website: z.string().max(500).optional(),
});

export const ownerRequestListQuerySchema = z.object({
  status: z.enum(OWNER_REQUEST_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ownerRequestIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });

export const ownerRequestNoteBodySchema = z.object({
  adminNote: z.string().trim().max(2000, 'Ghi chú tối đa 2000 ký tự'),
});

export const ownerRequestApproveBodySchema = z.object({
  businessName: text(2, 150, 'Tên cơ sở kinh doanh'),
  phone: phoneSchema,
});

export const ownerRequestRejectBodySchema = z.object({
  reason: text(10, 500, 'Lý do'),
});
