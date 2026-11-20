import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../../shared/api/http-client';
import { bookingService } from '../../booking/services/bookingService';
import type { CourtSummary } from '../../booking/types/booking';
import { formatCurrency, formatDisplayDate, formatDuration, formatTimeRange } from '../../booking/utils/booking';
import { StateBlock } from '../../matchmaking/components/StateBlocks';
import { usePollingResource } from '../hooks/usePollingResource';
import { matchmakingService } from '../services/matchmakingService';
import type { MatchBookingPreview, MatchDetail } from '../types/matchmaking';
import { MatchSplitBookingConfirm } from '../components/match-detail/MatchSplitBookingConfirm';
import '../match-detail.css';

function useCourts(match: MatchDetail | null, city: string, district: string, page: number) {
  const [courts, setCourts] = useState<CourtSummary[]>([]);
  const [meta, setMeta] = useState<{ page: number; totalPages: number; total: number } | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const date = match?.bookingWindow?.date ?? null;
  const startTime = match?.bookingWindow?.startTime ?? null;
  const endTime = match?.bookingWindow?.endTime ?? null;
  const load = useCallback(async () => {
    if (!date || !startTime || !endTime) return;
    const requestId = ++requestRef.current;
    setStatus('loading');
    setError(null);
    try {
      const response = await bookingService.searchCourts({
        date,
        startTime,
        endTime,
        city: city.trim() || undefined,
        district: district.trim() || undefined,
        page,
        limit: 9,
      });
      if (requestRef.current !== requestId) return;
      setCourts(response.data);
      setMeta(response.meta);
      setStatus('success');
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Không thể tải danh sách sân.');
    }
  }, [date, startTime, endTime, city, district, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return { courts, meta, status, error, reload: load };
}

export function MatchCourtBookingPage() {
  const { matchId: matchIdParam } = useParams();
  const matchId = Number(matchIdParam);
  const navigate = useNavigate();
  const loadMatch = useCallback(() => matchmakingService.getMatch(matchId), [matchId]);
  const { data: match, loading, error, refresh } = usePollingResource(loadMatch, Number.isSafeInteger(matchId) && matchId > 0);

  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [page, setPage] = useState(1);
  const { courts, meta, status: courtStatus, error: courtError, reload } = useCourts(match, city, district, page);

  const [selected, setSelected] = useState<CourtSummary | null>(null);
  const [preview, setPreview] = useState<MatchBookingPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const previewRequestRef = useRef(0);

  const bookingWindow = match?.bookingWindow ?? null;
  const canBook = Boolean(match && match.status === 'PENDING_COURT' && match.isOwner && bookingWindow);

  const openPreview = useCallback(async (court: CourtSummary) => {
    const requestId = ++previewRequestRef.current;
    setSelected(court);
    setPreview(null);
    setPreviewError(null);
    setNotice(null);
    setPreviewLoading(true);
    try {
      const data = await matchmakingService.getBookingPreview(matchId, court.id);
      if (previewRequestRef.current !== requestId) return;
      setPreview(data);
    } catch (err) {
      if (previewRequestRef.current !== requestId) return;
      setPreviewError(err instanceof ApiError ? err.message : 'Không thể kiểm tra khung giờ.');
    } finally {
      if (previewRequestRef.current === requestId) setPreviewLoading(false);
    }
  }, [matchId]);

  const confirmBooking = async () => {
    if (!selected || !preview || submitting) return;
    setSubmitting(true);
    setPreviewError(null);
    setNotice(null);
    try {
      await matchmakingService.createSplitBooking(matchId, selected.id);
      navigate(`/matchmaking/matches/${matchId}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setPreviewError(err.message);
        if (err.code === 'MATCH_SPLIT_INSUFFICIENT_WALLET') {
          // Re-read the authoritative wallet state so the blocked list is fresh.
          try {
            setPreview(await matchmakingService.getBookingPreview(matchId, selected.id));
          } catch {
            // Keep the original error visible.
          }
        }
      } else {
        setPreviewError('Không thể đặt sân. Vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const remind = async (playerIds?: number[]) => {
    if (!selected || reminding) return;
    setReminding(true);
    setNotice(null);
    setPreviewError(null);
    try {
      const result = await matchmakingService.remindTopup(matchId, selected.id, playerIds);
      setNotice(result.sent > 0
        ? `Đã gửi nhắc nạp ví cho ${result.sent} thành viên.`
        : result.skipped > 0
          ? 'Các thành viên này đã được nhắc nạp ví hôm nay.'
          : 'Không có thành viên phù hợp để gửi nhắc.');
    } catch (err) {
      setPreviewError(err instanceof ApiError ? err.message : 'Không thể gửi nhắc nạp ví.');
    } finally {
      setReminding(false);
    }
  };

  const summaryWindow = useMemo(() => {
    if (!bookingWindow) return null;
    return `${formatDisplayDate(bookingWindow.date)} · ${formatTimeRange(bookingWindow.startTime, bookingWindow.endTime)}${bookingWindow.durationMinutes ? ` (${formatDuration(bookingWindow.durationMinutes)})` : ''}`;
  }, [bookingWindow]);

  if (!Number.isSafeInteger(matchId) || matchId <= 0) {
    return <StateBlock title="Mã trận không hợp lệ" description="Vui lòng quay lại danh sách trận." />;
  }
  if (loading && !match) {
    return <StateBlock title="Đang tải kèo..." description="Vui lòng chờ trong giây lát." />;
  }
  if (error && !match) {
    return <StateBlock title="Không thể tải kèo" description={error.message} actionLabel="Thử lại" onAction={refresh} />;
  }
  if (!match) {
    return <StateBlock title="Không tìm thấy kèo" description="Kèo không tồn tại hoặc bạn không có quyền xem." />;
  }
  if (!canBook || !bookingWindow) {
    return <section className="match-detail-page">
      <nav className="match-breadcrumb"><Link to={`/matchmaking/matches/${matchId}`}>← Chi tiết trận</Link><span>/</span><span>Đặt sân</span></nav>
      <StateBlock
        title="Không thể đặt sân cho kèo này"
        description={match.isOwner ? 'Kèo không còn ở trạng thái chờ đặt sân.' : 'Chỉ chủ kèo mới có thể đặt sân cho kèo.'}
        actionLabel="Về chi tiết trận"
        onAction={() => navigate(`/matchmaking/matches/${matchId}`)}
      />
    </section>;
  }

  return <section className="match-detail-page">
    <nav className="match-breadcrumb" aria-label="Điều hướng đặt sân">
      <Link to={`/matchmaking/matches/${matchId}`}>← Chi tiết trận</Link><span>/</span><span>Đặt sân cho kèo</span>
    </nav>

    <header className="match-panel">
      <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 24 }}>Đặt sân cho trận #{matchId}</h1>
      <p className="match-muted" style={{ marginTop: 8 }}>Khung giờ được lấy từ kèo và không thể thay đổi.</p>
      <div className="match-facts" style={{ marginTop: 16 }}>
        <div><span>NGÀY CHƠI</span><strong>{formatDisplayDate(bookingWindow.date)}</strong></div>
        <div><span>KHUNG GIỜ</span><strong>{formatTimeRange(bookingWindow.startTime, bookingWindow.endTime)}</strong></div>
        <div><span>THỜI LƯỢNG</span><strong>{bookingWindow.durationMinutes ? formatDuration(bookingWindow.durationMinutes) : '—'}</strong></div>
        <div><span>SỐ NGƯỜI</span><strong>{match.currentPlayers}</strong></div>
      </div>
      {error && <p className="match-muted" style={{ marginTop: 12 }}>Chưa cập nhật được trạng thái mới nhất: {error.message}</p>}
    </header>

    <section className="match-panel">
      <div className="match-panel-heading">
        <h2>Tìm sân còn trống</h2>
        <span className="match-muted">{summaryWindow}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          THÀNH PHỐ
          <input value={city} onChange={event => { setCity(event.target.value); setPage(1); }} placeholder="VD: TP. Hồ Chí Minh" style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          QUẬN / HUYỆN
          <input value={district} onChange={event => { setDistrict(event.target.value); setPage(1); }} placeholder="VD: Quận 1" style={inputStyle} />
        </label>
      </div>

      {courtStatus === 'loading' && <p role="status" className="match-muted">Đang tìm sân phù hợp...</p>}
      {courtStatus === 'error' && <div role="alert" className="match-error"><p>{courtError}</p><button className="match-button match-button-secondary" onClick={() => void reload()}>Thử lại</button></div>}
      {courtStatus === 'success' && courts.length === 0 && <p className="match-note">Không tìm thấy sân trống đúng khung giờ. Hãy thử đổi khu vực hoặc quay lại sau.</p>}
      {courtStatus === 'success' && courts.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {courts.map(court => <article key={court.id} className="match-panel" style={{ padding: 18 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{court.facility.name}</h3>
          <p className="match-muted">{court.name}</p>
          <p className="match-muted" style={{ marginTop: 6 }}>{[court.facility.address, court.facility.district, court.facility.city].filter(Boolean).join(', ')}</p>
          <p style={{ marginTop: 8, fontWeight: 700 }}>{court.priceFrom === null ? 'Chưa có giá' : `${formatCurrency(court.priceFrom)} /giờ`}</p>
          <button className="match-button match-button-primary" style={{ width: '100%', marginTop: 14 }} onClick={() => void openPreview(court)}>Chọn sân này</button>
        </article>)}
      </div>}
      {meta && meta.totalPages > 1 && <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
        <button className="match-button match-button-secondary" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Trước</button>
        <span className="match-muted" style={{ alignSelf: 'center' }}>Trang {meta.page}/{meta.totalPages}</span>
        <button className="match-button match-button-secondary" disabled={page >= meta.totalPages} onClick={() => setPage(current => current + 1)}>Sau</button>
      </div>}
    </section>

    {notice && <div className="match-note" role="status">{notice}</div>}

    {selected && <MatchSplitBookingConfirm
      matchId={matchId}
      courtName={`${selected.facility.name} · ${selected.name}`}
      preview={preview}
      loading={previewLoading}
      error={previewError}
      submitting={submitting}
      reminding={reminding}
      onClose={() => { if (!submitting) setSelected(null); }}
      onConfirm={() => void confirmBooking()}
      onRemind={(playerIds) => void remind(playerIds)}
      onRefresh={() => void openPreview(selected)}
    />}
  </section>;
}

const inputStyle: CSSProperties = {
  height: 42,
  padding: '0 12px',
  borderRadius: 8,
  backgroundColor: 'var(--bg-table-header)',
  fontSize: 13,
  color: 'var(--text-primary)',
};
