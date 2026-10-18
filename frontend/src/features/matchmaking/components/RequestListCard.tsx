import { Link } from 'react-router-dom';
import { formatDate } from '../../../shared/utils/formatDate';
import type { MatchmakingRequestSummary } from '../types/matchmaking';
import { Countdown, StatusPill } from './StateBlocks';

interface RequestListCardProps {
  request: MatchmakingRequestSummary;
  onFindPlayers: (id: number) => void;
  onCancel: (id: number) => void;
  cancelling: boolean;
}

const matchTypeLabel: Record<string, string> = { SINGLES: 'Đơn', DOUBLES: 'Đôi' };

export function RequestListCard({ request, onFindPlayers, onCancel, cancelling }: RequestListCardProps) {
  const isOpen = request.status === 'OPEN';
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            {matchTypeLabel[request.matchType] ?? request.matchType}
          </span>
          <StatusPill status={request.status} />
        </div>
        {isOpen && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}><Countdown expiresAt={request.expiresAt} /></span>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
        <span>📅 {formatDate(request.preferredDate)}</span>
        <span>🕒 {request.preferredStartTime.slice(0, 5)} - {request.preferredEndTime.slice(0, 5)}</span>
        {request.area && <span>📍 {request.area}</span>}
        <span>👥 {request.requiredPlayers - request.remainingCount}/{request.requiredPlayers} người</span>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Còn thiếu <strong>{request.remainingCount}</strong> người để tạo trận.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {isOpen && (
          <>
            <button
              type="button"
              onClick={() => onFindPlayers(request.id)}
              style={{ padding: '9px 16px', borderRadius: 8, backgroundColor: 'var(--color-brand)', color: '#FFFFFF', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Tìm người
            </button>
            <button
              type="button"
              onClick={() => onCancel(request.id)}
              disabled={cancelling}
              style={{ padding: '9px 16px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', color: 'var(--color-danger)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              {cancelling ? 'Đang hủy...' : 'Hủy yêu cầu'}
            </button>
          </>
        )}
        {request.status === 'MATCHED' && request.matchId && (
          <Link to={`/matchmaking/matches/${request.matchId}`} style={{ padding: '9px 16px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>
            Xem trận #{request.matchId}
          </Link>
        )}
      </div>
    </div>
  );
}
