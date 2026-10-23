import { useState } from 'react';
import { ApiError } from '../../../shared/api/http-client';
const messages: Record<string, string> = {
  OPENING_HOURS_CONFLICT: 'Giờ mới không hợp lệ hoặc ảnh hưởng booking còn hiệu lực.', ADDRESS_CHANGE_REQUIRES_REVIEW: 'Vui lòng gửi đề xuất địa chỉ để Admin duyệt.', REVIEW_ALREADY_PENDING: 'Đã có hồ sơ chờ duyệt.', REVIEW_NOT_RESUBMITTABLE: 'Chỉ hồ sơ bị từ chối mới được gửi lại.',
  PRICING_INTERVAL_OVERLAP: 'Khung giá chồng lấn với một khung đang có hiệu lực.', SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING: 'Khoảng này có booking còn hiệu lực. Hãy xử lý booking đủ điều kiện trước.', SLOT_BLOCK_OVERLAP_BLOCK: 'Khoảng này trùng một khóa bảo trì.', SLOT_BLOCK_OUTSIDE_ADVANCE_WINDOW: 'Ngày vượt cửa sổ bảo trì cho phép.', SLOT_BLOCK_INVALID_RANGE: 'Chọn khoảng giờ trong giờ mở cửa, kết thúc sau bắt đầu.', COURT_NOT_ELIGIBLE: 'Cơ sở và sân phải được duyệt hoạt động.', VALIDATION_FAILED: 'Vui lòng kiểm tra các trường nhập.',
};
export function useOwnerAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function run(action: () => Promise<unknown>, done?: () => void) {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try { await action(); setSuccess('Đã lưu thay đổi.'); done?.(); }
    catch (error) { setError(error instanceof ApiError ? messages[error.code] ?? (error.statusCode === 404 ? 'Không tìm thấy tài nguyên trong phạm vi của bạn.' : 'Thao tác không thành công. Vui lòng thử lại.') : 'Không thể kết nối. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }
  return { busy, error, success, run };
}
