import { z } from 'zod';

/** Client mirror of PRD Decision #8 / Tech Design validation; the server stays authoritative. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

const normalize = (value: string) => value.normalize('NFKC');

export function hasValidPasswordLength(password: string): boolean {
  const length = [...normalize(password)].length; // code points after NFKC, as on the server
  return length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH;
}

export function isPasswordSameAsEmail(password: string, email: string): boolean {
  return email.length > 0 && normalize(password).toLowerCase() === normalize(email).toLowerCase();
}

export function changePasswordSchema(email: string) {
  return z.object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
    newPassword: z.string()
      .min(1, 'Vui lòng nhập mật khẩu mới.')
      .refine(hasValidPasswordLength, `Mật khẩu mới phải có từ ${PASSWORD_MIN_LENGTH} đến ${PASSWORD_MAX_LENGTH} ký tự.`)
      .refine(value => !isPasswordSameAsEmail(value, email), 'Mật khẩu mới không được trùng với email.'),
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu mới.'),
  }).refine(values => values.confirmPassword === values.newPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp.',
  });
}

export type ChangePasswordValues = z.infer<ReturnType<typeof changePasswordSchema>>;
