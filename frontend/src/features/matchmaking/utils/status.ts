export const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Đang tìm người',
  MATCHED: 'Đã ghép trận',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
  PENDING: 'Chờ phản hồi',
  ACCEPTED: 'Đã chấp nhận',
  DECLINED: 'Đã từ chối',
  WITHDRAWN: 'Đã rút lui',
  PENDING_COURT: 'Chờ đặt sân',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang diễn ra',
  COMPLETED: 'Đã kết thúc',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export const MATCHMAKING_ERROR_MESSAGES: Record<string, string> = {
  MATCHMAKING_DISABLED: 'Tính năng ghép trận đang tạm khóa.',
  MATCHMAKING_ACTIVE_REQUEST_LIMIT: 'Bạn đã có một yêu cầu đang mở cho loại trận này.',
  MATCHMAKING_INVALID_TIME_WINDOW: 'Khung giờ không hợp lệ, phải dài ít nhất bằng thời lượng trận đấu.',
  MATCHMAKING_INVALID_SKILL_RANGE: 'Khoảng trình độ không hợp lệ: trình độ tối thiểu phải thấp hơn hoặc bằng tối đa.',
  MATCHMAKING_SCHEDULE_CONFLICT: 'Bạn đã có lịch chơi trùng với khung giờ này.',
  MATCHMAKING_REQUEST_NOT_FOUND: 'Không tìm thấy yêu cầu ghép trận.',
  MATCHMAKING_REQUEST_NOT_CANCELLABLE: 'Yêu cầu này không thể hủy ở trạng thái hiện tại.',
  MATCHMAKING_REQUEST_NOT_OPEN: 'Yêu cầu không còn mở để mời thêm người.',
  MATCHMAKING_INVITATION_NOT_FOUND: 'Không tìm thấy lời mời.',
  MATCHMAKING_INVITATION_NOT_WITHDRAWABLE: 'Không thể rút khỏi nhóm ở thời điểm này.',
  MATCHMAKING_INVITATION_NOT_PENDING: 'Lời mời đã được xử lý hoặc đã đóng.',
  MATCHMAKING_INVITATION_EXPIRED: 'Lời mời đã hết hạn.',
  MATCHMAKING_INVITATION_SELF: 'Bạn không thể tự mời chính mình.',
  MATCHMAKING_INVITATION_DUPLICATE: 'Đã có lời mời đang chờ cho người chơi này.',
  MATCHMAKING_INVITEE_NOT_FOUND: 'Không tìm thấy người chơi được mời.',
  MATCH_NOT_FOUND: 'Không tìm thấy trận đấu.',
  MATCH_ALREADY_STARTED: 'Trận đấu đã bắt đầu, không thể rời.',
  MATCH_NOT_LEAVABLE: 'Trạng thái trận đấu không cho phép rời.',
  VALIDATION_FAILED: 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại.',
};

export function errorMessage(code: string, fallback: string): string {
  return MATCHMAKING_ERROR_MESSAGES[code] ?? fallback;
}
