export function relativeTime(iso: string, now = Date.now()): string {
  const value = Date.parse(iso);
  if (Number.isNaN(value)) return '';
  const seconds = Math.max(0, Math.floor((now - value) / 1000));
  if (seconds < 60) return 'Vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(value).toLocaleDateString('vi-VN');
}

const TYPE_LABELS: ReadonlyArray<readonly [prefix: string, label: string, exact?: boolean]> = [
  ['OWNER_BOOKING', 'Đặt sân'],
  ['OWNER_PAYOUT', 'Ví & Payout'],
  ['OWNER_EARNING', 'Doanh thu'],
  ['OWNER_FACILITY', 'Cơ sở'],
  ['OWNER_COURT', 'Sân'],
  ['OWNER_STANDARD', 'Tiêu chuẩn mặt sân'],
  ['OWNER_', 'Chủ sân'],
  ['ADMIN_HIGH_RISK_REPORT', 'Báo cáo ưu tiên', true],
  ['ADMIN_REPORT', 'Báo cáo'],
  ['ADMIN_FACILITY', 'Cơ sở'],
  ['ADMIN_STANDARD', 'Tiêu chuẩn mặt sân'],
  ['ADMIN_OWNER_EARNING', 'Doanh thu chủ sân'],
  ['ADMIN_PAYOUT', 'Ví & Payout'],
  ['ADMIN_REFUND', 'Thanh toán'],
  ['ADMIN_PAYMENT', 'Thanh toán'],
  ['ADMIN_CONFIG', 'Cấu hình'],
  ['ADMIN_SECURITY', 'Bảo mật'],
  ['ADMIN_', 'Quản trị'],
  ['MM_', 'Ghép trận'],
  ['SOCIAL_', 'Cộng đồng'],
  ['BOOKING_', 'Đặt sân'],
  ['PAYMENT_', 'Đặt sân'],
  ['RATING_', 'Đánh giá'],
  ['TOURNAMENT_', 'Giải đấu'],
];

export function notificationTypeLabel(type: string): string {
  const rule = TYPE_LABELS.find(([prefix, , exact]) => exact ? type === prefix : type.startsWith(prefix));
  return rule?.[1] ?? 'Hệ thống';
}
