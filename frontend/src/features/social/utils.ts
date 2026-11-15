import { ApiError } from '../../shared/api/http-client';
export const matchTypeLabels = { SINGLES: 'Đơn', DOUBLES: 'Đôi', GROUP: 'Giao lưu' };
export const recruitmentStatusLabels: Record<string, string> = { OPEN: 'Đang tuyển', MATCHED: 'Đã chốt kèo', CANCELLED: 'Đã hủy', EXPIRED: 'Đã hết hạn' };
export function socialError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 404) return 'Nội dung không khả dụng.';
    if (error.code === 'SOCIAL_RATE_LIMITED') return `Bạn thao tác quá nhanh hoặc đã đạt giới hạn.${error.retryAfterSeconds ? ` Vui lòng thử lại sau ${error.retryAfterSeconds} giây.` : ' Vui lòng thử lại sau.'}`;
    if (error.statusCode >= 500) return 'Không thể hoàn tất thao tác. Nội dung của bạn vẫn được giữ để thử lại.';
    return error.message;
  }
  return 'Không thể kết nối. Vui lòng thử lại; nội dung đang soạn vẫn được giữ.';
}
export function dateTime(value: string) { return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
export function playTime(start: string, minutes: number) { return `${dateTime(start)} – ${new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(new Date(new Date(start).getTime() + minutes * 60000))}`; }
