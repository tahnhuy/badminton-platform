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

export function notificationTypeLabel(type: string): string {
  if (type.startsWith('OWNER_BOOKING')) return 'Đặt sân';
  if (type.startsWith('OWNER_PAYOUT')) return 'Ví & Payout';
  if (type.startsWith('OWNER_EARNING')) return 'Doanh thu';
  if (type.startsWith('OWNER_FACILITY')) return 'Cơ sở';
  if (type.startsWith('OWNER_COURT')) return 'Sân';
  if (type.startsWith('OWNER_STANDARD')) return 'Tiêu chuẩn mặt sân';
  if (type.startsWith('OWNER_')) return 'Chủ sân';
  if (type === 'ADMIN_HIGH_RISK_REPORT') return 'Báo cáo ưu tiên';
  if (type.startsWith('ADMIN_REPORT')) return 'Báo cáo';
  if (type.startsWith('ADMIN_FACILITY')) return 'Cơ sở';
  if (type.startsWith('ADMIN_STANDARD')) return 'Tiêu chuẩn mặt sân';
  if (type.startsWith('ADMIN_OWNER_EARNING')) return 'Doanh thu chủ sân';
  if (type.startsWith('ADMIN_PAYOUT')) return 'Ví & Payout';
  if (type.startsWith('ADMIN_REFUND') || type.startsWith('ADMIN_PAYMENT')) return 'Thanh toán';
  if (type.startsWith('ADMIN_CONFIG')) return 'Cấu hình';
  if (type.startsWith('ADMIN_SECURITY')) return 'Bảo mật';
  if (type.startsWith('ADMIN_')) return 'Quản trị';
  if (type.startsWith('MM_')) return 'Ghép trận';
  if (type.startsWith('SOCIAL_')) return 'Cộng đồng';
  if (type.startsWith('BOOKING_') || type.startsWith('PAYMENT_')) return 'Đặt sân';
  if (type.startsWith('RATING_')) return 'Đánh giá';
  if (type.startsWith('TOURNAMENT_')) return 'Giải đấu';
  return 'Hệ thống';
}
