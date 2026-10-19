import { ApiError } from '../../../shared/api/http-client';

const RATING_ERROR_MESSAGES: Record<string, string> = {
  RATING_MATCH_NOT_PLAYED: 'Trận đấu chưa có kết quả hợp lệ nên chưa thể đánh giá.',
  RATING_DISABLED: 'Đánh giá cho trận giải đấu hiện đang tắt.',
  MATCH_NOT_COMPLETED: 'Trận đấu chưa kết thúc nên chưa thể đánh giá.',
  RATING_SELF_FORBIDDEN: 'Không thể tự đánh giá bản thân.',
  RATING_TARGET_NOT_PARTICIPANT: 'Người được đánh giá không thuộc trận đấu.',
  RATING_NOT_PARTICIPANT: 'Bạn không phải thành viên của trận đấu.',
  RATING_SUMMARY_FORBIDDEN: 'Bạn không có quyền xem đánh giá này.',
  MATCH_NOT_FOUND: 'Không tìm thấy trận đấu.',
  USER_NOT_FOUND: 'Không tìm thấy người dùng.',
};

export function ratingErrorMessage(error: unknown, fallback = 'Đã có lỗi xảy ra, vui lòng thử lại.'): string {
  if (error instanceof ApiError) {
    return RATING_ERROR_MESSAGES[error.code] ?? error.message ?? fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
