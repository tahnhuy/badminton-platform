import { Link } from 'react-router-dom';
import { useBookingMatchContext } from '../hooks/useBookingMatchContext';

export function MatchBookingContext() {
  const { matchId } = useBookingMatchContext();
  if (!matchId) return null;
  return <aside aria-label="Ngữ cảnh đặt sân cho trận" className="rounded-2xl border border-primary/15 bg-accent p-5 text-sm leading-6">
    <strong>Đặt sân cho trận #{matchId}</strong>
    <p>Kiểm tra ngày, khung giờ và thời lượng nhóm đã thống nhất. Đặt sân chưa đồng nghĩa trận đã được xác nhận.</p>
    <Link to={`/matchmaking/matches/${matchId}`} className="mt-2 inline-flex min-h-11 items-center rounded-lg font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">← Quay lại trận #{matchId}</Link>
  </aside>;
}
