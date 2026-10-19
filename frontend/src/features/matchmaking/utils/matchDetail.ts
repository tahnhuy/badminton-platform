import { ApiError } from '../../../shared/api/http-client';
import type { MatchDetail } from '../types/matchmaking';
import { errorMessage } from './status';

export const matchDate = (value: string) => new Date(value).toLocaleDateString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
});
export const matchTime = (value: string) => new Date(value).toLocaleTimeString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
});
export function matchTimeRange(match: MatchDetail) {
  return match.scheduledEndAt
    ? `${matchTime(match.scheduledAt)} – ${matchTime(match.scheduledEndAt)}`
    : `${matchTime(match.scheduledAt)} (giờ dự kiến)`;
}
export const cancellationReasons: Record<string, string> = {
  COURT_NOT_BOOKED: 'Chưa đặt được sân trước giờ chơi.',
  BOOKING_CANCELLED: 'Booking sân đã bị hủy.',
  INSUFFICIENT_PLAYERS: 'Một thành viên đã rời trận.',
};
export const matchStatusDescriptions: Record<MatchDetail['status'], string> = {
  PENDING_COURT: 'Nhóm đã đủ người. Chủ kèo cần đặt sân trước thời hạn để chốt lịch chơi.',
  CONFIRMED: 'Sân và lịch chơi đã được xác nhận. Hãy kiểm tra thông tin trước khi đến sân.',
  IN_PROGRESS: 'Trận đấu đang diễn ra. Bạn có thể đánh giá người chơi khi trận kết thúc.',
  COMPLETED: 'Trận đấu đã kết thúc. Cùng ghi nhận kỹ năng và tinh thần thể thao của người chơi.',
  CANCELLED: 'Trận đấu đã bị hủy. Bạn có thể tạo yêu cầu mới để tiếp tục tìm người chơi.',
};
export function matchActionError(reason: unknown): string {
  return reason instanceof ApiError
    ? errorMessage(reason.code, 'Không thể xử lý thao tác. Vui lòng tải lại trạng thái trận và thử lại.')
    : 'Không thể kết nối. Vui lòng thử lại.';
}
