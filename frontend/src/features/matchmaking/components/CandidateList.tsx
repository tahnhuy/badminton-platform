import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../shared/api/http-client';
import { matchmakingService } from '../services/matchmakingService';
import type { Candidate } from '../types/matchmaking';
import { errorMessage } from '../utils/status';
import { StateBlock } from './StateBlocks';

interface CandidateListProps {
  requestId: number;
  onInvited: () => void;
}

const PAGE_SIZE = 9;

export function CandidateList({ requestId, onInvited }: CandidateListProps) {
  const [search, setSearch] = useState('');
  const [includeOutOfRange, setIncludeOutOfRange] = useState(false);
  const [page, setPage] = useState(1);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState<Record<number, 'sent' | 'error'>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const response = await matchmakingService.browseCandidates(requestId, {
        search: search || undefined,
        includeOutOfRange,
        page,
        limit: PAGE_SIZE,
      });
      setCandidates(response.data);
      setTotalPages(response.meta.totalPages || 1);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Không thể tải danh sách người chơi.');
    }
  }, [requestId, search, includeOutOfRange, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (candidate: Candidate) => {
    setFeedback(null);
    try {
      await matchmakingService.sendInvitation(requestId, candidate.playerId);
      setInvited((prev) => ({ ...prev, [candidate.playerId]: 'sent' }));
      onInvited();
    } catch (err) {
      setInvited((prev) => ({ ...prev, [candidate.playerId]: 'error' }));
      setFeedback(err instanceof ApiError ? errorMessage(err.code, err.message) : 'Không thể gửi lời mời.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Tìm theo tên người chơi"
          style={{ flex: '1 1 240px', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14 }}
        />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={includeOutOfRange} onChange={(e) => { setIncludeOutOfRange(e.target.checked); setPage(1); }} />
          Hiện cả người ngoài khoảng trình độ
        </label>
      </div>

      {feedback && <span role="alert" style={{ fontSize: 13, color: 'var(--color-danger)' }}>{feedback}</span>}

      {status === 'loading' && <StateBlock title="Đang tải..." description="Đang tìm người chơi phù hợp." />}
      {status === 'error' && error && <StateBlock title="Không tải được danh sách" description={error} actionLabel="Thử lại" onAction={() => void load()} />}
      {status === 'success' && candidates.length === 0 && (
        <StateBlock title="Không có người chơi phù hợp" description="Thử đổi từ khoá tìm kiếm hoặc bật hiển thị ngoài khoảng trình độ." />
      )}
      {status === 'success' && candidates.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {candidates.map((candidate) => {
            const inviteState = invited[candidate.playerId];
            return (
              <div key={candidate.playerId} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--color-brand)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {(candidate.displayName ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{candidate.displayName ?? `Người chơi #${candidate.playerId}`}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{candidate.skill?.name ?? 'Chưa xác định trình độ'}</span>
                  </div>
                </div>
                {candidate.skillMismatch && (
                  <span style={{ fontSize: 12, color: 'var(--color-warning)', fontWeight: 600 }}>⚠ Ngoài khoảng trình độ mong muốn</span>
                )}
                <button
                  type="button"
                  onClick={() => void invite(candidate)}
                  disabled={inviteState === 'sent'}
                  style={{
                    padding: '9px 14px',
                    borderRadius: 8,
                    backgroundColor: inviteState === 'sent' ? 'var(--bg-tag-uid)' : 'var(--color-brand)',
                    color: inviteState === 'sent' ? 'var(--text-secondary)' : '#FFFFFF',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: inviteState === 'sent' ? 'default' : 'pointer',
                  }}
                >
                  {inviteState === 'sent' ? 'Đã gửi lời mời' : 'Gửi lời mời'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '8px 14px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', fontWeight: 600, fontSize: 13 }}>
            Trước
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Trang {page} / {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: '8px 14px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', fontWeight: 600, fontSize: 13 }}>
            Sau
          </button>
        </div>
      )}
    </div>
  );
}
