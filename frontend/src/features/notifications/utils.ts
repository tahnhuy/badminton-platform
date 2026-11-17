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
  if (type.startsWith('MM_')) return 'Ghép trận';
  if (type.startsWith('SOCIAL_')) return 'Cộng đồng';
  if (type.startsWith('BOOKING_') || type.startsWith('PAYMENT_')) return 'Đặt sân';
  if (type.startsWith('TOURNAMENT_')) return 'Giải đấu';
  return 'Hệ thống';
}
