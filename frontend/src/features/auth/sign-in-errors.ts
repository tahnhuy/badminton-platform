import { ApiError } from '@/shared/api/http-client';

export const SUPPORT_CONTACT = import.meta.env.VITE_SUPPORT_CONTACT || 'support@badminton-platform.com';

export function signInErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.';
  switch (error.code) {
    case 'AUTH_INVALID_CREDENTIALS': return 'Email hoặc mật khẩu không đúng';
    case 'AUTH_ACCOUNT_RESTRICTED':
      return `Tài khoản của bạn đã bị hạn chế. Vui lòng liên hệ bộ phận hỗ trợ qua ${SUPPORT_CONTACT}.`;
    case 'AUTH_ACCOUNT_LOCKED': {
      const until = error.details[0]?.lockedUntil;
      const date = typeof until === 'string' ? new Date(until) : null;
      const time = date && !Number.isNaN(date.getTime())
        ? ` (Mở khóa lúc: ${date.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })})` : '';
      return `Tài khoản tạm thời bị khóa do nhiều lần đăng nhập thất bại. Vui lòng thử lại sau${time}.`;
    }
    case 'AUTH_RATE_LIMITED': return 'Quá nhiều yêu cầu đăng nhập từ thiết bị của bạn. Vui lòng thử lại sau.';
    case 'VALIDATION_FAILED': return 'Vui lòng kiểm tra lại thông tin đã nhập.';
    case 'AUTH_SESSION_INVALID':
    case 'AUTH_SESSION_EXPIRED': return 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.';
    default: return 'Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại.';
  }
}
