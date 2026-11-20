import { ApiError } from '@/shared/api/http-client';

export type ChangePasswordField = 'currentPassword' | 'newPassword';

export interface ChangePasswordFeedback {
  fieldErrors: Partial<Record<ChangePasswordField, string>>;
  /** Form-level message; null when every problem belongs to a field. */
  message: string | null;
}

const POLICY_MESSAGE = 'Mật khẩu mới chưa đạt quy định: từ 8 đến 64 ký tự và không trùng với email.';

/** Maps stable API codes to Vietnamese feedback; raw server messages are never shown. */
export function changePasswordFeedback(error: unknown): ChangePasswordFeedback {
  if (!(error instanceof ApiError)) return { fieldErrors: {}, message: 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.' };
  switch (error.code) {
    case 'AUTH_CURRENT_PASSWORD_INCORRECT':
      return { fieldErrors: { currentPassword: 'Mật khẩu hiện tại không đúng.' }, message: null };
    case 'AUTH_PASSWORD_POLICY_VIOLATION':
      return { fieldErrors: { newPassword: POLICY_MESSAGE }, message: null };
    case 'AUTH_RATE_LIMITED':
      return { fieldErrors: {}, message: 'Bạn đã thử đổi mật khẩu quá nhiều lần. Vui lòng thử lại sau ít phút.' };
    case 'VALIDATION_FAILED': {
      const fieldErrors: ChangePasswordFeedback['fieldErrors'] = {};
      for (const detail of error.details) {
        if (detail.field === 'currentPassword') fieldErrors.currentPassword = 'Mật khẩu hiện tại không hợp lệ.';
        if (detail.field === 'newPassword') {
          fieldErrors.newPassword = detail.code === 'AUTH_PASSWORD_POLICY_VIOLATION' ? POLICY_MESSAGE : 'Mật khẩu mới không hợp lệ.';
        }
      }
      return { fieldErrors, message: Object.keys(fieldErrors).length > 0 ? null : 'Vui lòng kiểm tra lại thông tin đã nhập.' };
    }
    default:
      return { fieldErrors: {}, message: 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.' };
  }
}
