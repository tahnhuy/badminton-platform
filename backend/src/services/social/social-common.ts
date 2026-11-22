import { createHash } from 'crypto';
import { AppError, NotFoundError } from '../../errors/AppError';
import { socialConfig } from '../../shared/config/social-config';

// Shared Social helpers: error codes (Social Tech Design §9), gate (§8.10 / Matchmaking
// §24.10), trimming and creation hashes (§13).

export const POST_BODY_MAX = 2000;
export const POST_TITLE_MAX = 120;
export const COMMENT_BODY_MAX = 500;

export const postNotFound = () => new NotFoundError('Nội dung không khả dụng', 'SOCIAL_POST_NOT_FOUND');
export const commentNotFound = () => new NotFoundError('Nội dung không khả dụng', 'SOCIAL_COMMENT_NOT_FOUND');
export const forbidden = () => new AppError('SOCIAL_FORBIDDEN', 403, 'Bạn không có quyền thực hiện thao tác này');
export const notEditable = () => new AppError('SOCIAL_POST_NOT_EDITABLE', 409, 'Bài viết không thể chỉnh sửa');
export const clientIdConflict = () => new AppError('SOCIAL_CLIENT_ID_CONFLICT', 409, 'Mã yêu cầu đã được dùng cho nội dung khác');
export const contentEmpty = () => new AppError('SOCIAL_CONTENT_EMPTY', 400, 'Nội dung không được để trống');
export const contentTooLong = (max: number) => new AppError('SOCIAL_CONTENT_TOO_LONG', 400, `Nội dung tối đa ${max} ký tự`);
export const imageLimit = () => new AppError('SOCIAL_IMAGE_LIMIT', 400, 'Tối đa 4 ảnh cho mỗi bài viết');
/** Match-finding posts support business actions only, not social reactions/comments. */
export const interactionNotAllowed = () => new AppError('SOCIAL_INTERACTION_NOT_ALLOWED', 409, 'Bài tìm kèo không hỗ trợ cảm xúc hoặc bình luận');

export function rateLimited(retryAfterSeconds: number, message: string): AppError {
  const error = new AppError('SOCIAL_RATE_LIMITED', 429, message);
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

/** Blocks Social writes when SOCIAL_FEED_ENABLED is false (create, edit, comment, react). */
export async function assertSocialEnabled(): Promise<void> {
  const config = await socialConfig.get();
  if (!config.feedEnabled) throw new AppError('SOCIAL_DISABLED', 409, 'Tính năng cộng đồng đang tạm khóa');
}

/** Trimmed text, or null when empty after trimming. */
export function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Character count matching PostgreSQL char_length (code points). */
export function charLength(value: string): number {
  return [...value].length;
}

export function sha256Hex(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Immutable creation hash of a canonical object (fixed key order, version-tagged). */
export function canonicalHash(canonical: Record<string, unknown>): string {
  return sha256Hex(JSON.stringify(canonical));
}
