import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../../shared/api/http-client';
import { bookingService } from '../../booking/services/bookingService';

import { formatCurrency, formatDisplayDate, formatDuration, formatTimeRange } from '../../booking/utils/booking';
import { StateBlock } from '../../matchmaking/components/StateBlocks';
import { usePollingResource } from '../hooks/usePollingResource';
import { matchmakingService } from '../services/matchmakingService';
import type { MatchBookingPreview, MatchDetail } from '../types/matchmaking';
import { MatchSplitBookingConfirm } from '../components/match-detail/MatchSplitBookingConfirm';

interface CourtOption {
  id: number;
  name: string;
  priceFrom: number | null;
  facility: { name: string; address: string; district: string; city: string };
}

function useCourts(match: MatchDetail | null, city: string, district: string, page: number) {
  const [courts, setCourts] = useState<CourtOption[]>([]);
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
      const response = await bookingService.searchFacilities({
        date,
        startTime,
        endTime,
        city: city.trim() || undefined,
        district: district.trim() || undefined,
        page,
        limit: 9,
      });
      if (requestRef.current !== requestId) return;
      setCourts(response.data.flatMap(item => item.courts.map(court => ({
        id: court.id,
        name: court.name,
        priceFrom: court.priceFrom ?? item.priceFrom,
        facility: {
          name: item.facility.name,
          address: item.facility.address,
          district: item.facility.district,
          city: item.facility.city,
        },
      }))));
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

  const [selected, setSelected] = useState<CourtOption | null>(null);
  const [preview, setPreview] = useState<MatchBookingPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const previewRequestRef = useRef(0);

  const bookingWindow = match?.bookingWindow ?? null;
  const canBook = Boolean(match && match.status === 'PENDING_COURT' && match.isOwner && bookingWindow);

  const openPreview = useCallback(async (court: CourtOption) => {
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
    return <section className="match-detail-page mx-auto w-full max-w-320 px-3 pt-5 pb-8 sm:px-8 sm:pt-7 sm:pb-12">
      <nav className="match-breadcrumb mb-5 flex flex-wrap gap-2.5 text-xs text-muted-foreground [&_a:hover]:text-primary [&_a:hover]:underline"><Link to={`/matchmaking/matches/${matchId}`}>← Chi tiết trận</Link><span>/</span><span>Đặt sân</span></nav>
      <StateBlock
        title="Không thể đặt sân cho kèo này"
        description={match.isOwner ? 'Kèo không còn ở trạng thái chờ đặt sân.' : 'Chỉ chủ kèo mới có thể đặt sân cho kèo.'}
        actionLabel="Về chi tiết trận"
        onAction={() => navigate(`/matchmaking/matches/${matchId}`)}
      />
    </section>;
  }

  return <section className="match-detail-page mx-auto w-full max-w-320 px-3 pt-5 pb-8 sm:px-8 sm:pt-7 sm:pb-12">
    <nav className="match-breadcrumb mb-5 flex flex-wrap gap-2.5 text-xs text-muted-foreground [&_a:hover]:text-primary [&_a:hover]:underline" aria-label="Điều hướng đặt sân">
      <Link to={`/matchmaking/matches/${matchId}`}>← Chi tiết trận</Link><span>/</span><span>Đặt sân cho kèo</span>
    </nav>

    <header className="match-panel min-w-0 rounded-2xl border border-border bg-card p-4.5 shadow-sm wrap-anywhere sm:p-6 [&_h2]:text-base">
      <h1 className="font-sans font-extrabold text-2xl">Đặt sân cho trận #{matchId}</h1>
      <p className="match-muted text-xs leading-5 text-muted-foreground mt-2" >Khung giờ được lấy từ kèo và không thể thay đổi.</p>
      <div className="match-facts mb-4.5 grid grid-cols-1 gap-3 sm:grid-cols-2 [&>div]:grid [&>div]:gap-2 [&>div]:rounded-lg [&>div]:bg-muted [&>div]:p-3.5 [&_span]:text-2xs [&_span]:font-bold [&_span]:tracking-wide [&_span]:text-muted-foreground [&_strong]:text-sm [&_strong]:leading-6 mt-4" >
        <div><span>NGÀY CHƠI</span><strong>{formatDisplayDate(bookingWindow.date)}</strong></div>
        <div><span>KHUNG GIỜ</span><strong>{formatTimeRange(bookingWindow.startTime, bookingWindow.endTime)}</strong></div>
        <div><span>THỜI LƯỢNG</span><strong>{bookingWindow.durationMinutes ? formatDuration(bookingWindow.durationMinutes) : '—'}</strong></div>
        <div><span>SỐ NGƯỜI</span><strong>{match.currentPlayers}</strong></div>
      </div>
      {error && <p className="match-muted text-xs leading-5 text-muted-foreground mt-3" >Chưa cập nhật được trạng thái mới nhất: {error.message}</p>}
    </header>

    <section className="match-panel min-w-0 rounded-2xl border border-border bg-card p-4.5 shadow-sm wrap-anywhere sm:p-6 [&_h2]:text-base">
      <div className="match-panel-heading mb-4 flex flex-wrap items-center justify-between gap-2.5 border-b border-border pb-4">
        <h2>Tìm sân còn trống</h2>
        <span className="match-muted text-xs leading-5 text-muted-foreground">{summaryWindow}</span>
      </div>
      <div className="flex flex-wrap gap-3 mb-4.5">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          THÀNH PHỐ
          <input value={city} onChange={event => { setCity(event.target.value); setPage(1); }} placeholder="VD: TP. Hồ Chí Minh" className="h-11 rounded-lg border border-input bg-muted px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          QUẬN / HUYỆN
          <input value={district} onChange={event => { setDistrict(event.target.value); setPage(1); }} placeholder="VD: Quận 1" className="h-11 rounded-lg border border-input bg-muted px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
      </div>

      {courtStatus === 'loading' && <p role="status" className="match-muted text-xs leading-5 text-muted-foreground">Đang tìm sân phù hợp...</p>}
      {courtStatus === 'error' && <div role="alert" className="match-error mb-5 rounded-lg bg-destructive/10 p-4.5 text-sm leading-6 text-destructive"><p>{courtError}</p><button className="match-button inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold disabled:opacity-50 match-button-secondary bg-secondary text-secondary-foreground" onClick={() => void reload()}>Thử lại</button></div>}
      {courtStatus === 'success' && courts.length === 0 && <p className="match-note my-4 rounded-lg bg-muted p-3.5 text-xs leading-5 text-muted-foreground">Không tìm thấy sân trống đúng khung giờ. Hãy thử đổi khu vực hoặc quay lại sau.</p>}
      {courtStatus === 'success' && courts.length > 0 && <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
        {courts.map(court => <article key={court.id} className="match-panel min-w-0 rounded-2xl border border-border bg-card p-4.5 shadow-sm wrap-anywhere sm:p-6 [&_h2]:text-base p-4.5!" >
          <h3 className="text-base font-bold">{court.facility.name}</h3>
          <p className="match-muted text-xs leading-5 text-muted-foreground">{court.name}</p>
          <p className="match-muted text-xs leading-5 text-muted-foreground mt-1.5" >{[court.facility.address, court.facility.district, court.facility.city].filter(Boolean).join(', ')}</p>
          <p className="mt-2 font-bold">{court.priceFrom === null ? 'Chưa có giá' : `${formatCurrency(court.priceFrom)} /giờ`}</p>
          <button className="match-button inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold disabled:opacity-50 match-button-primary border-primary bg-primary text-primary-foreground hover:bg-primary/90 w-full mt-3.5"  onClick={() => void openPreview(court)}>Chọn sân này</button>
        </article>)}
      </div>}
      {meta && meta.totalPages > 1 && <div className="flex gap-2.5 justify-center mt-4">
        <button className="match-button inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold disabled:opacity-50 match-button-secondary bg-secondary text-secondary-foreground" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Trước</button>
        <span className="match-muted text-xs leading-5 text-muted-foreground self-center" >Trang {meta.page}/{meta.totalPages}</span>
        <button className="match-button inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold disabled:opacity-50 match-button-secondary bg-secondary text-secondary-foreground" disabled={page >= meta.totalPages} onClick={() => setPage(current => current + 1)}>Sau</button>
      </div>}
    </section>

    {notice && <div className="match-note my-4 rounded-lg bg-muted p-3.5 text-xs leading-5 text-muted-foreground" role="status">{notice}</div>}

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
