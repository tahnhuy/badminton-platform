import { useCallback, useEffect, useRef, useState } from 'react';
import { useModalA11y } from '../../../shared/hooks/useModalA11y';
import { CloseIcon } from '../../../components/common/Icons';
import { ratingsService } from '../services/ratingsService';
import { StarRatingDisplay, StarRatingInput } from './StarRating';
import { ratingErrorMessage } from '../utils/messages';
import '../ratings.css';
import type { CreateRatingItem, PendingResponse } from '../types/ratings';

interface Draft {
  selected: boolean;
  skill: number | null;
  attitude: number | null;
  comment: string;
}

interface RatingModalProps {
  matchId: number;
  context?: { scheduledAt: string; facilityName?: string | null; courtName?: string | null };
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

function buildDrafts(data: PendingResponse): Record<number, Draft> {
  const drafts: Record<number, Draft> = {};
  for (const player of data.pendingPlayers) {
    drafts[player.playerId] = { selected: false, skill: null, attitude: null, comment: '' };
  }
  return drafts;
}

export function RatingModal(props: RatingModalProps) {
  return <RatingDialog key={`${props.matchId}:${props.isOpen}`} {...props} />;
}

function RatingDialog({ matchId, context, isOpen, onClose, onSubmitted }: RatingModalProps) {
  const requestVersion = useRef(0);
  const submitLock = useRef(false);
  useEffect(() => () => { requestVersion.current += 1; }, []);
  const close = () => { if (!submitLock.current) onClose(); };
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement;
    return () => { if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
  }, [isOpen]);
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, close);
  const [data, setData] = useState<PendingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async (preserveDrafts = false) => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await ratingsService.getPending(matchId);
      if (version !== requestVersion.current) return;
      setData(result);
      setDrafts(current => {
        const next = buildDrafts(result);
        if (preserveDrafts) {
          for (const player of result.pendingPlayers) {
            if (current[player.playerId]) next[player.playerId] = current[player.playerId];
          }
        }
        return next;
      });
    } catch (error) {
      if (version === requestVersion.current) setLoadError(ratingErrorMessage(error, 'Không thể tải danh sách đánh giá.'));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (!isOpen) return;
    setSuccessMessage(null);
    setSubmitError(null);
    setFieldError(null);
    void load();
  }, [isOpen, load]);

  const updateDraft = (playerId: number, patch: Partial<Draft>) => {
    const next = { ...drafts, [playerId]: { ...drafts[playerId], ...patch } };
    setDrafts(next);
    const selected = Object.values(next).filter(draft => draft.selected);
    if (selected.length > 0 && selected.every(draft => draft.skill !== null && draft.attitude !== null)) setFieldError(null);
  };

  const handleSubmit = async () => {
    if (submitLock.current) return;
    setFieldError(null);
    setSubmitError(null);
    setSuccessMessage(null);
    if (!data) return;

    const items: CreateRatingItem[] = [];
    for (const player of data.pendingPlayers) {
      const draft = drafts[player.playerId];
      if (!draft?.selected) continue;
      if (draft.skill === null || draft.attitude === null) {
        setFieldError('Mỗi người được chọn cần có đủ điểm kỹ năng và thái độ.');
        document.getElementById(`${draft.skill === null ? 'skill' : 'attitude'}-${player.playerId}`)?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
        return;
      }
      const comment = draft.comment.trim();
      items.push({
        ratedPlayerId: player.playerId,
        skillRating: draft.skill,
        attitudeRating: draft.attitude,
        ...(comment ? { comment } : {}),
      });
    }

    if (items.length === 0) {
      setFieldError('Chọn ít nhất một người để đánh giá.');
      dialogRef.current?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus();
      return;
    }

    submitLock.current = true;
    const version = requestVersion.current;
    setSubmitting(true);
    try {
      await ratingsService.submitRatings(matchId, items);
      onSubmitted?.();
      if (version !== requestVersion.current) return;
      setSuccessMessage('Đánh giá đã được ghi nhận.');
      await load(true);
    } catch (error) {
      if (version === requestVersion.current) setSubmitError(ratingErrorMessage(error, 'Không thể gửi đánh giá.'));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedCount = Object.values(drafts).filter(draft => draft.selected).length;
  const total = (data?.pendingPlayers.length ?? 0) + (data?.ratedPlayers.length ?? 0);

  return (
    <div className="rating-backdrop" onClick={close}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="rating-modal-title"
        aria-describedby="rating-description" aria-busy={submitting} tabIndex={-1}
        className="rating-dialog" onClick={event => event.stopPropagation()}>
        <header className="rating-hero">
          <div className="rating-heading-row">
            <span className="rating-eyebrow">SAU TRẬN ĐẤU · #{matchId}</span>
            <button className="rating-close" type="button" onClick={close} disabled={submitting} aria-label="Đóng">
              <CloseIcon size={20} />
            </button>
          </div>
          <h2 id="rating-modal-title">Đánh giá người chơi sau trận</h2>
          <p id="rating-description">Ghi nhận kỹ năng và tinh thần thể thao của đồng đội, đối thủ.</p>
          <div className="rating-context">
            {data && <span>{data.matchType === 'SINGLES' ? 'Đấu đơn' : 'Đấu đôi'}</span>}
            {context && <span>{new Date(context.scheduledAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>}
            {context?.facilityName && <span>{context.facilityName}{context.courtName ? ` · ${context.courtName}` : ''}</span>}
          </div>
          {data && <div className="rating-progress">
            <span>Đã gửi {data.ratedPlayers.length}/{total} người</span>
            <progress aria-label="Tiến độ đánh giá" value={data.ratedPlayers.length} max={total || 1} />
          </div>}
        </header>
        <div className="rating-body">
          {loading && <p role="status">Đang tải...</p>}
          {loadError && <div role="alert" className="rating-error"><p>{loadError}</p>
            <button className="rating-button" type="button" onClick={() => void load(true)}>Thử lại</button></div>}
          {!loading && !loadError && data && <>
            {successMessage && <p role="status" className="rating-success">{successMessage}</p>}
            {submitError && <p role="alert" className="rating-error">{submitError}</p>}
            {fieldError && <p role="alert" className="rating-error">{fieldError}</p>}
            {total === 0 && <p className="rating-note">Không có người chơi để đánh giá.</p>}
            {data.pendingPlayers.length > 0 && <fieldset disabled={submitting} className="rating-fieldset" aria-label="Người chơi cần đánh giá">
              <legend>Chọn người bạn muốn đánh giá</legend>
              <p className="rating-muted">Bạn có thể gửi cho từng người và tiếp tục vào lúc khác.</p>
              <ul className="rating-list">{data.pendingPlayers.map(player => {
                const draft = drafts[player.playerId];
                if (!draft) return null;
                return <li key={player.playerId} className={`rating-card ${draft.selected ? 'is-selected' : ''}`}>
                  <label className="rating-player">
                    <input type="checkbox" checked={draft.selected}
                      onChange={event => updateDraft(player.playerId, { selected: event.target.checked })} />
                    <span className="rating-avatar" aria-hidden="true">{(player.fullName?.trim() || '?').slice(0, 1).toUpperCase()}</span>
                    <span>{player.fullName ?? `Người chơi #${player.playerId}`}</span>
                  </label>
                  {draft.selected && <div className="rating-draft">
                    <div className="rating-dimensions">
                      <StarRatingInput id={`skill-${player.playerId}`} label="Kỹ năng" value={draft.skill}
                        invalid={Boolean(fieldError) && draft.skill === null} onChange={value => updateDraft(player.playerId, { skill: value })} />
                      <StarRatingInput id={`attitude-${player.playerId}`} label="Thái độ" value={draft.attitude}
                        invalid={Boolean(fieldError) && draft.attitude === null} onChange={value => updateDraft(player.playerId, { attitude: value })} />
                    </div>
                    <label htmlFor={`comment-${player.playerId}`}>Nhận xét <span className="rating-muted">(không bắt buộc)</span></label>
                    <textarea id={`comment-${player.playerId}`} value={draft.comment} maxLength={500} rows={3}
                      placeholder="Chia sẻ nhận xét công bằng, tôn trọng…"
                      onChange={event => updateDraft(player.playerId, { comment: event.target.value })} />
                    <span className="rating-counter">{draft.comment.length}/500</span>
                  </div>}
                </li>;
              })}</ul>
            </fieldset>}
            {data.pendingPlayers.length === 0 && total > 0 && <p className="rating-success">Bạn đã đánh giá tất cả người chơi.</p>}
            {data.ratedPlayers.length > 0 && <section aria-label="Đánh giá đã gửi">
              <h3>Bạn đã đánh giá</h3>
              <ul className="rating-list">{data.ratedPlayers.map(player => <li key={player.playerId} className="rating-card rating-submitted">
                <div className="rating-heading-row"><strong>{player.fullName ?? `Người chơi #${player.playerId}`}</strong><span className="rating-badge">Đã gửi</span></div>
                <div className="rating-readonly-scores">
                  <span>Kỹ năng <StarRatingDisplay value={player.rating.skillRating} label="Kỹ năng" /></span>
                  <span>Thái độ <StarRatingDisplay value={player.rating.attitudeRating} label="Thái độ" /></span>
                </div>
                {player.rating.comment && <p className="rating-comment">{player.rating.comment}</p>}
                <time className="rating-muted" dateTime={player.rating.createdAt}>{new Date(player.rating.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time>
              </li>)}</ul>
            </section>}
          </>}
          <aside className="rating-note"><strong>Đánh giá công bằng & tôn trọng</strong>
            <p>Hai điểm theo thang 1–5. Đánh giá là tự nguyện và không thể sửa hoặc xóa sau khi gửi. Điểm kỹ năng là đầu vào để hệ thống điều chỉnh trình độ theo cấu hình.</p>
          </aside>
        </div>
        <footer className="rating-actions">
          <span className="rating-muted">{submitting ? 'Đang ghi nhận đánh giá, vui lòng chờ…' : `${selectedCount} người được chọn`}</span>
          <div><button className="rating-button" type="button" onClick={close} disabled={submitting}>Đóng</button>
            {!loading && !loadError && Boolean(data?.pendingPlayers.length) && <button className="rating-button rating-primary" type="button"
              onClick={() => void handleSubmit()} disabled={submitting}>{submitting ? 'Đang gửi...' : `Gửi đánh giá (${selectedCount} người)`}</button>}
          </div>
        </footer>
      </div>
    </div>
  );
}
