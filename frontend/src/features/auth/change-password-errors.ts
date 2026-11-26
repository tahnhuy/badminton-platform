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
    case 'AUTH_PASSWORD_CHANGE_OTP_REQUIRED':
      return { fieldErrors: {}, message: 'Vui lòng xác minh email trước khi đổi mật khẩu.' };
    case 'AUTH_OTP_INVALID':
      return { fieldErrors: {}, message: 'Mã xác minh không đúng. Vui lòng kiểm tra lại.' };
    case 'AUTH_OTP_EXPIRED':
      return { fieldErrors: {}, message: 'Mã xác minh đã hết hạn. Hãy bắt đầu lại yêu cầu để nhận mã mới.' };
    case 'AUTH_OTP_LOCKED':
      return { fieldErrors: {}, message: 'Bạn đã nhập sai quá nhiều lần nên mã này bị khóa. Hãy bắt đầu lại yêu cầu để nhận mã mới.' };
    case 'AUTH_OTP_RESEND_TOO_SOON':
      return { fieldErrors: {}, message: 'Vui lòng chờ một chút trước khi gửi lại mã.' };
    case 'AUTH_RESET_TOKEN_INVALID':
      return { fieldErrors: {}, message: 'Quyền đổi mật khẩu đã hết hạn. Vui lòng xác minh lại email.' };
    case 'VALIDATION_FAILED': {
      const fieldErrors: ChangePasswordFeedback['fieldErrors'] = passwordValidationFields(error);
      return { fieldErrors, message: Object.keys(fieldErrors).length > 0 ? null : 'Vui lòng kiểm tra lại thông tin đã nhập.' };
    }
    default:
      return { fieldErrors: {}, message: 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.' };
  }
}

function passwordValidationFields(error: ApiError) {
  const fieldErrors: ChangePasswordFeedback['fieldErrors'] = {};
  for (const detail of error.details) {
    if (detail.field === 'currentPassword') fieldErrors.currentPassword = 'Mật khẩu hiện tại không hợp lệ.';
    if (detail.field === 'newPassword') {
      fieldErrors.newPassword = detail.code === 'AUTH_PASSWORD_POLICY_VIOLATION' ? POLICY_MESSAGE : 'Mật khẩu mới không hợp lệ.';
    }
  }
  return fieldErrors;
}
