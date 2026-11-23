import { ApiError } from '@/shared/api/http-client';

/** Survey/registration error codes that end the current form and need a reload or a later retry. */
export const FORM_OUTDATED_CODES = new Set(['AUTH_SKILL_SURVEY_OUTDATED', 'AUTH_REGISTRATION_FORM_OUTDATED']);
export const SURVEY_UNAVAILABLE = 'AUTH_SKILL_SURVEY_UNAVAILABLE';

export const FORM_OUTDATED_MESSAGE = 'Biểu mẫu đã cập nhật, vui lòng tải lại trang.';
export const SURVEY_UNAVAILABLE_MESSAGE = 'Đăng ký tạm thời chưa khả dụng. Vui lòng thử lại sau.';

/** Page-level message for a failed registration; field errors are handled by the caller. Never shows server text. */
export function registerErrorMessage(reason: unknown): string {
  if (!(reason instanceof ApiError)) return 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.';
  if (FORM_OUTDATED_CODES.has(reason.code)) return FORM_OUTDATED_MESSAGE;
  switch (reason.code) {
    case SURVEY_UNAVAILABLE: return SURVEY_UNAVAILABLE_MESSAGE;
    case 'AUTH_EMAIL_ALREADY_REGISTERED': return 'Email này đã được đăng ký. Câu trả lời khảo sát vẫn được giữ nguyên.';
    case 'AUTH_PASSWORD_POLICY_VIOLATION': return 'Mật khẩu phải có từ 8 đến 64 ký tự và không được trùng với email.';
    case 'AUTH_RATE_LIMITED': return 'Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau.';
    case 'VALIDATION_FAILED': return 'Vui lòng kiểm tra lại thông tin đã nhập.';
    default: return 'Đã xảy ra lỗi trong quá trình đăng ký. Vui lòng thử lại.';
  }
}
