import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePollingResource } from '../hooks/usePollingResource';
import { ApiError } from '../../../shared/api/http-client';
import { formatDate } from '../../../shared/utils/formatDate';
import { matchmakingService } from '../services/matchmakingService';
import type { Invitation } from '../types/matchmaking';
import { errorMessage } from '../utils/status';
import { Countdown, StateBlock, StatusPill } from './StateBlocks';

interface InvitationListProps {
  direction: 'RECEIVED' | 'SENT';
  refreshToken: number;
  onChanged: () => void;
}

const PAGE_SIZE = 10;

export function InvitationList({ direction, refreshToken, onChanged }: InvitationListProps) {
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(() => {
    void refreshToken;
    return matchmakingService.listInvitations({ direction, page, limit: PAGE_SIZE });
  }, [direction, page, refreshToken]);
  const resource = usePollingResource(load);
  const invitations: Invitation[] = resource.data?.data ?? [];
  const totalPages = resource.data?.meta.totalPages || 1;
  const status = resource.loading ? 'loading' : resource.error ? 'error' : 'success';
  const error = resource.error?.message ?? null;

  const act = async (id: number, action: () => Promise<unknown>) => {
    setBusyId(id);
    setFeedback(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setFeedback(err instanceof ApiError ? errorMessage(err.code, err.message) : 'Thao tác thất bại.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {feedback && <span role="alert" style={{ fontSize: 13, color: 'var(--color-danger)' }}>{feedback}</span>}
      {status === 'loading' && <StateBlock title="Đang tải..." description="Đang tải danh sách lời mời." />}
      {status === 'error' && error && <StateBlock title="Không tải được danh sách" description={error} actionLabel="Thử lại" onAction={resource.refresh} />}
      {status === 'success' && invitations.length === 0 && (
        <StateBlock
          title={direction === 'RECEIVED' ? 'Chưa có lời mời nào' : 'Bạn chưa gửi lời mời nào'}
          description={direction === 'RECEIVED' ? 'Các lời mời tìm đối thủ sẽ xuất hiện ở đây.' : 'Hãy tạo yêu cầu và gửi lời mời tới người chơi phù hợp.'}
        />
      )}

      {status === 'success' && invitations.map((invitation) => (
        <div key={invitation.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              {direction === 'RECEIVED' ? invitation.counterpart.displayName ?? 'Người chơi' : invitation.counterpart.displayName ?? `Người chơi #${invitation.counterpart.playerId}`}
            </span>
            <StatusPill status={invitation.status} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
            <span>{invitation.request.matchType === 'DOUBLES' ? 'Đôi' : 'Đơn'}</span>
            <span>📅 {formatDate(invitation.request.preferredDate)}</span>
            <span>🕒 {invitation.request.preferredStartTime.slice(0, 5)} - {invitation.request.preferredEndTime.slice(0, 5)}</span>
            {invitation.request.area && <span>📍 {invitation.request.area}</span>}
          </div>

          {invitation.status === 'PENDING' && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}><Countdown expiresAt={invitation.expiresAt} /></span>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {invitation.status === 'ACCEPTED' && invitation.request.status === 'OPEN' && <Link to={`/matchmaking/requests/${invitation.requestId}`}>Xem nhóm</Link>}
            {invitation.matchId && <Link to={`/matchmaking/matches/${invitation.matchId}`}>Xem trận</Link>}
            {direction === 'RECEIVED' && invitation.status === 'PENDING' && (
              <>
                <button type="button" disabled={busyId === invitation.id} onClick={() => void act(invitation.id, () => matchmakingService.respondInvitation(invitation.id, 'ACCEPTED'))} style={{ padding: '9px 16px', borderRadius: 8, backgroundColor: 'var(--color-brand)', color: '#FFFFFF', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Chấp nhận
                </button>
                <button type="button" disabled={busyId === invitation.id} onClick={() => void act(invitation.id, () => matchmakingService.respondInvitation(invitation.id, 'DECLINED'))} style={{ padding: '9px 16px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', color: 'var(--color-danger)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Từ chối
                </button>
              </>
            )}
            {direction === 'RECEIVED' && invitation.status === 'ACCEPTED' && invitation.request.status === 'OPEN' && (
              <button type="button" disabled={busyId === invitation.id} onClick={() => void act(invitation.id, () => matchmakingService.withdrawInvitation(invitation.id))} style={{ padding: '9px 16px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Rút khỏi nhóm
              </button>
            )}
            {direction === 'SENT' && invitation.status === 'PENDING' && (
              <button type="button" disabled={busyId === invitation.id} onClick={() => void act(invitation.id, () => matchmakingService.cancelInvitation(invitation.id))} style={{ padding: '9px 16px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Thu hồi lời mời
              </button>
            )}
          </div>
        </div>
      ))}

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '8px 14px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', fontWeight: 600, fontSize: 13 }}>Trước</button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Trang {page} / {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: '8px 14px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', fontWeight: 600, fontSize: 13 }}>Sau</button>
        </div>
      )}
    </div>
  );
}
