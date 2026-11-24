import { ApiError } from '../../../shared/api/http-client';

export function pinErrorMessage(reason: unknown): string {
  if (!(reason instanceof ApiError)) return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
  if (reason.code === 'WALLET_PIN_LOCKED') {
    const lockedUntil = (reason.details[0] as { lockedUntil?: string } | undefined)?.lockedUntil;
    return lockedUntil
      ? `Mã PIN đang tạm khóa đến ${new Date(lockedUntil).toLocaleString('vi-VN', { hour12: false })}.`
      : 'Mã PIN đang tạm khóa. Vui lòng thử lại sau.';
  }
  switch (reason.code) {
    case 'WALLET_INSUFFICIENT_BALANCE': return 'Số tiền rút vượt số dư khả dụng. Vui lòng giảm số tiền hoặc làm mới số dư ví.';
    case 'WALLET_BANK_ACCOUNT_NOT_FOUND': return 'Tài khoản nhận tiền không còn tồn tại. Vui lòng chọn lại tài khoản.';
    case 'WALLET_BANK_ACCOUNT_FORBIDDEN': return 'Tài khoản nhận tiền không thuộc tài khoản của bạn.';
    case 'VALIDATION_FAILED': return 'Thông tin rút tiền chưa hợp lệ. Hãy kiểm tra số tiền, tài khoản nhận và mã PIN 6 chữ số.';
    case 'WALLET_PIN_INVALID': return 'Mã PIN rút tiền không đúng.';
    case 'WALLET_PIN_NOT_SET': return 'Bạn chưa thiết lập mã PIN rút tiền.';
    case 'WALLET_PIN_WEAK': return 'Mã PIN quá yếu. Hãy chọn 6 số khó đoán hơn.';
    case 'AUTH_OTP_INVALID': return 'Mã xác minh không đúng.';
    case 'AUTH_OTP_EXPIRED': return 'Mã xác minh đã hết hạn. Hãy bắt đầu lại yêu cầu để nhận mã mới.';
    case 'AUTH_OTP_LOCKED': return 'Bạn đã nhập sai quá nhiều lần nên mã này bị khóa. Hãy bắt đầu lại yêu cầu để nhận mã mới.';
    case 'AUTH_OTP_RESEND_TOO_SOON': return 'Vui lòng chờ một chút trước khi gửi lại mã.';
    case 'AUTH_RESET_TOKEN_INVALID': return 'Quyền đặt lại đã hết hạn. Vui lòng xác minh lại email.';
    case 'AUTH_RATE_LIMITED': return 'Bạn đã yêu cầu quá nhiều mã. Vui lòng thử lại sau.';
    default: return 'Không thể hoàn tất. Vui lòng thử lại.';
  }
}
