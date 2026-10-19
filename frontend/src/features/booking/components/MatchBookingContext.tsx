import { Link } from 'react-router-dom';
import { useBookingMatchContext } from '../hooks/useBookingMatchContext';

export function MatchBookingContext() {
  const { matchId } = useBookingMatchContext();
  if (!matchId) return null;
  return <aside aria-label="Ngữ cảnh đặt sân cho trận" style={{ padding: 16, borderRadius: 12, background: 'var(--bg-tag-green)', color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.8 }}>
    <strong>Đặt sân cho trận #{matchId}</strong>
    <p>Kiểm tra ngày, khung giờ và thời lượng nhóm đã thống nhất. Đặt sân chưa đồng nghĩa trận đã được xác nhận.</p>
    <Link to={`/matchmaking/matches/${matchId}`} style={{ color: 'var(--color-brand)', fontWeight: 700 }}>← Quay lại trận #{matchId}</Link>
  </aside>;
}
