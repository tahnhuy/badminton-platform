import { z } from 'zod';

/** Field rules of the partnership form (PRD §8); the server applies the same limits. */

const PHONE = /^0(3|5|7|8|9)\d{8}$/;

/** "+84 90 123 4567", "84901234567" and "0901.234.567" all become "0901234567". */
export function normalizePhone(value: string): string {
  const digits = value.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) return `0${digits.slice(3)}`;
  if (digits.startsWith('84') && digits.length === 11) return `0${digits.slice(2)}`;
  return digits;
}

export const phoneField = z.string().trim().min(1, 'Vui lòng nhập số điện thoại.')
  .refine(value => PHONE.test(normalizePhone(value)), 'Số điện thoại Việt Nam chưa đúng, ví dụ 0901234567.');

const text = (label: string, min: number, max: number) => z.string().trim()
  .min(1, `Vui lòng nhập ${label}.`)
  .min(min, `${label[0].toUpperCase()}${label.slice(1)} cần ít nhất ${min} ký tự.`)
  .max(max, `${label[0].toUpperCase()}${label.slice(1)} tối đa ${max} ký tự.`);

export const partnershipSchema = z.object({
  contactName: text('họ tên', 2, 100),
  email: z.string().trim().min(1, 'Vui lòng nhập email.').max(254, 'Email quá dài.').email('Email không đúng định dạng.'),
  phone: phoneField,
  facilityName: text('tên cơ sở', 2, 150),
  addressLine: text('địa chỉ', 5, 255),
  district: text('quận/huyện', 2, 100),
  city: text('tỉnh/thành phố', 2, 100),
  expectedCourts: z.string().trim().min(1, 'Vui lòng nhập số sân.')
    .refine(value => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 50, 'Số sân từ 1 đến 50.'),
  note: z.string().trim().max(1000, 'Ghi chú tối đa 1000 ký tự.'),
  consent: z.boolean().refine(Boolean, 'Vui lòng đồng ý để SmashPro liên hệ.'),
  website: z.string(),
});

export type PartnershipValues = z.infer<typeof partnershipSchema>;
export type PartnershipField = keyof PartnershipValues;

export const PARTNERSHIP_DEFAULTS: PartnershipValues = {
  contactName: '', email: '', phone: '', facilityName: '', addressLine: '', district: '', city: '',
  expectedCourts: '', note: '', consent: false, website: '',
};

export const EMAIL_HAS_ACCOUNT_MESSAGE = 'Email này đã có tài khoản SmashPro. Mỗi tài khoản chỉ có một vai trò, nên tài khoản chủ sân cần một email khác (ví dụ ten+chusan@gmail.com vẫn nhận thư ở hộp thư cũ).';
