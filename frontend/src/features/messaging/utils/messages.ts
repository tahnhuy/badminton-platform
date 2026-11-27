import { ApiError } from '../../../shared/api/http-client';

/**
 * Vietnamese copy for messaging error codes whose backend message is not user-facing
 * Vietnamese. `MESSAGING_ACTION_NOT_AVAILABLE` is intentionally absent: the backend uses it
 * as a neutral code for blocked or inactive counterparts, so the call-site fallback states
 * what failed without revealing why.
 */
const MESSAGING_ERROR_MESSAGES: Record<string, string> = {
  MESSAGING_DISABLED: 'Tính năng nhắn tin tạm thời không khả dụng.',
  MESSAGING_CONVERSATION_NOT_FOUND: 'Không tìm thấy cuộc trò chuyện.',
  MESSAGING_MESSAGE_NOT_FOUND: 'Không tìm thấy tin nhắn.',
  MESSAGING_NOT_GROUP: 'Thao tác này chỉ áp dụng cho nhóm chat.',
  MESSAGING_GROUP_LOCKED: 'Nhóm đang khóa gửi tin nhắn.',
  MESSAGING_SYSTEM_GROUP: 'Nhóm này do hệ thống quản lý.',
  MESSAGING_MESSAGE_RECALLED: 'Tin nhắn đã được thu hồi.',
};

export function messagingErrorMessage(
  error: unknown,
  fallback = 'Không thể thực hiện thao tác này, vui lòng thử lại.',
): string {
  if (error instanceof ApiError) {
    if (error.code === 'MESSAGING_ACTION_NOT_AVAILABLE') return fallback;
    return MESSAGING_ERROR_MESSAGES[error.code] ?? (error.message || fallback);
  }
  // Non-API failures (e.g. "Failed to fetch") carry browser-specific English text.
  return fallback;
}
