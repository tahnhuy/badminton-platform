import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePollingResource } from '../hooks/usePollingResource';
import { ApiError } from '../../../shared/api/http-client';
import { matchmakingService } from '../services/matchmakingService';
import type { MatchmakingRequestSummary, SkillLevel } from '../types/matchmaking';
import { InvitationList } from '../components/InvitationList';
import { RequestFormModal } from '../components/RequestFormModal';
import { RequestListCard } from '../components/RequestListCard';
import { StateBlock } from '../components/StateBlocks';
import { errorMessage } from '../utils/status';

const PAGE_SIZE = 10;
const LAST_AREA_KEY = 'matchmaking:lastArea';

type Tab = 'requests' | 'invitations';

export function MatchmakingPage() {
  const [tab, setTab] = useState<Tab>('requests');
  const [skillLevels, setSkillLevels] = useState<SkillLevel[]>([]);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [invitationDirection, setInvitationDirection] = useState<'RECEIVED' | 'SENT'>('RECEIVED');
  const [refreshToken, setRefreshToken] = useState(0);

  const defaultArea = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_AREA_KEY) ?? '' : '';

  const navigate = useNavigate();
  const loadRequests = useCallback(() => {
    void refreshToken;
    return matchmakingService.listRequests({ page, limit: PAGE_SIZE });
  }, [page, refreshToken]);
  const resource = usePollingResource(loadRequests, tab === 'requests');
  const requests: MatchmakingRequestSummary[] = resource.data?.data ?? [];
  const totalPages = resource.data?.meta.totalPages || 1;
  const status = resource.loading ? 'loading' : resource.error ? 'error' : 'success';
  const error = resource.error?.message ?? null;

  useEffect(() => {
    matchmakingService
      .listSkillLevels()
      .then(setSkillLevels)
      .catch(() => setSkillLevels([]));
  }, []);

  const handleCreated = (area: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LAST_AREA_KEY, area);
    setPage(1);
    setRefreshToken((token) => token + 1);
  };

  const cancelRequest = async (requestId: number) => {
    setCancellingId(requestId);
    setFeedback(null);
    try {
      await matchmakingService.cancelRequest(requestId);
      setRefreshToken((token) => token + 1);
    } catch (err) {
      setFeedback(err instanceof ApiError ? errorMessage(err.code, err.message) : 'Không thể hủy yêu cầu.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 26, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
            Tìm đối thủ
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Tạo yêu cầu, mời người chơi phù hợp và quản lý lời mời ghép trận.</p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          style={{ padding: '10px 18px', borderRadius: 8, backgroundColor: 'var(--color-brand)', color: '#FFFFFF', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          + Tạo yêu cầu
        </button>
      </header>

      <Link to="/matchmaking/matches">Các trận của tôi</Link>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['requests', 'invitations'] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => { setTab(key); }}
            style={{
              padding: '8px 16px',
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              color: tab === key ? '#FFFFFF' : 'var(--text-secondary)',
              backgroundColor: tab === key ? 'var(--color-brand)' : 'var(--bg-table-header)',
              cursor: 'pointer',
            }}
          >
            {key === 'requests' ? 'Yêu cầu của tôi' : 'Lời mời'}
          </button>
        ))}
      </div>

      {feedback && <span role="alert" style={{ fontSize: 13, color: 'var(--color-danger)' }}>{feedback}</span>}

      {tab === 'requests' && (
        <>
          {status === 'loading' && <StateBlock title="Đang tải..." description="Vui lòng chờ trong giây lát." />}
          {status === 'error' && error && <StateBlock title="Không tải được danh sách" description={error} actionLabel="Thử lại" onAction={resource.refresh} />}
          {status === 'success' && requests.length === 0 && (
            <StateBlock title="Chưa có yêu cầu ghép trận" description="Tạo yêu cầu để bắt đầu tìm đối thủ phù hợp." actionLabel="Tạo yêu cầu" onAction={() => setFormOpen(true)} />
          )}
          {status === 'success' && requests.map((request) => (
            <RequestListCard
              key={request.id}
              request={request}
              onFindPlayers={(id) => navigate(`/matchmaking/requests/${id}`)}
              onCancel={(id) => void cancelRequest(id)}
              cancelling={cancellingId === request.id}
            />
          ))}

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '8px 14px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', fontWeight: 600, fontSize: 13 }}>Trước</button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Trang {page} / {totalPages}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: '8px 14px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', fontWeight: 600, fontSize: 13 }}>Sau</button>
            </div>
          )}
        </>
      )}

      {tab === 'invitations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['RECEIVED', 'SENT'] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                onClick={() => setInvitationDirection(direction)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 9999,
                  fontSize: 13,
                  fontWeight: 600,
                  color: invitationDirection === direction ? '#FFFFFF' : 'var(--text-secondary)',
                  backgroundColor: invitationDirection === direction ? 'var(--color-brand)' : 'var(--bg-table-header)',
                  cursor: 'pointer',
                }}
              >
                {direction === 'RECEIVED' ? 'Đã nhận' : 'Đã gửi'}
              </button>
            ))}
          </div>
          <InvitationList key={invitationDirection} direction={invitationDirection} refreshToken={refreshToken} onChanged={() => setRefreshToken((token) => token + 1)} />
        </div>
      )}

      <RequestFormModal
        isOpen={formOpen}
        skillLevels={skillLevels}
        defaultArea={defaultArea}
        onClose={() => setFormOpen(false)}
        onCreated={(area) => handleCreated(area)}
      />
    </div>
  );
}
