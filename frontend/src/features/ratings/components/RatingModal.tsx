import { useCallback, useEffect, useRef, useState } from 'react';
import { useModalA11y } from '../../../shared/hooks/useModalA11y';
import { CloseIcon } from '../../../components/common/Icons';
import { ratingsService } from '../services/ratingsService';
import { StarRatingDisplay, StarRatingInput } from './StarRating';
import { ratingErrorMessage } from '../utils/messages';
import type { CreateRatingItem, PendingResponse } from '../types/ratings';

interface Draft {
  selected: boolean;
  skill: number | null;
  attitude: number | null;
  comment: string;
}

interface RatingModalProps {
  matchId: number;
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

function RatingDialog({ matchId, isOpen, onClose, onSubmitted }: RatingModalProps) {
  const requestVersion = useRef(0);
  const submitLock = useRef(false);
  useEffect(() => () => { requestVersion.current += 1; }, []);
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose);
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
    setDrafts((current) => ({ ...current, [playerId]: { ...current[playerId], ...patch } }));
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

  const hasPending = (data?.pendingPlayers.length ?? 0) > 0 || (data?.ratedPlayers.length ?? 0) > 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(19, 27, 46, 0.45)',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-modal-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '85vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-card, #FFFFFF)',
          borderRadius: 16,
          padding: 24,
          boxShadow: 'var(--shadow-modal)',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 id="rating-modal-title" style={{ margin: 0, fontSize: 18 }}>
              Đánh giá đối thủ
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              Điểm kỹ năng và thái độ theo thang 1–5. Đánh giá đã gửi không thể sửa.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" style={{ padding: 6, background: 'none' }}>
            <CloseIcon size={16} />
          </button>
        </div>

        {loading && <p>Đang tải...</p>}

        {loadError && (
          <div role="alert" style={{ marginTop: 16, color: 'var(--color-danger)' }}>
            <p>{loadError}</p>
            <button type="button" onClick={() => void load(true)}>
              Thử lại
            </button>
          </div>
        )}

        {!loading && !loadError && data && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {successMessage && (
              <p role="status" style={{ color: 'var(--color-brand)', margin: 0 }}>
                {successMessage}
              </p>
            )}
            {submitError && (
              <p role="alert" style={{ color: 'var(--color-danger)', margin: 0 }}>
                {submitError}
              </p>
            )}
            {fieldError && (
              <p role="alert" style={{ color: 'var(--color-danger)', margin: 0 }}>
                {fieldError}
              </p>
            )}

            {!hasPending && <p>Không có người chơi để đánh giá.</p>}

            {data.ratedPlayers.length > 0 && (
              <section aria-label="Đánh giá đã gửi">
                <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Bạn đã đánh giá</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.ratedPlayers.map((player) => (
                    <li
                      key={player.playerId}
                      style={{ border: '1px solid var(--border-medium, #d9dfd6)', borderRadius: 10, padding: 12 }}
                    >
                      <div style={{ fontWeight: 600 }}>{player.fullName ?? `Người chơi #${player.playerId}`}</div>
                      <div style={{ fontSize: 13 }}>
                        Kỹ năng: <StarRatingDisplay value={player.rating.skillRating} label="Kỹ năng" />
                        {'  '}
                        Thái độ: <StarRatingDisplay value={player.rating.attitudeRating} label="Thái độ" />
                      </div>
                      {player.rating.comment && (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{player.rating.comment}</div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.pendingPlayers.length > 0 && (
              <fieldset disabled={submitting} aria-label="Người chơi cần đánh giá" style={{ border: 0, padding: 0, margin: 0 }}>
                <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Chưa đánh giá</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.pendingPlayers.map((player) => {
                    const draft = drafts[player.playerId];
                    if (!draft) return null;
                    return (
                      <li
                        key={player.playerId}
                        style={{ border: '1px solid var(--border-medium, #d9dfd6)', borderRadius: 10, padding: 12 }}
                      >
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={draft.selected}
                            onChange={(event) => updateDraft(player.playerId, { selected: event.target.checked })}
                          />
                          {player.fullName ?? `Người chơi #${player.playerId}`}
                        </label>
                        {draft.selected && (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <StarRatingInput
                              id={`skill-${player.playerId}`}
                              label="Kỹ năng"
                              value={draft.skill}
                              invalid={!fieldError ? false : draft.skill === null}
                              onChange={(value) => updateDraft(player.playerId, { skill: value })}
                            />
                            <StarRatingInput
                              id={`attitude-${player.playerId}`}
                              label="Thái độ"
                              value={draft.attitude}
                              invalid={!fieldError ? false : draft.attitude === null}
                              onChange={(value) => updateDraft(player.playerId, { attitude: value })}
                            />
                            <div>
                              <label htmlFor={`comment-${player.playerId}`} style={{ fontSize: 13 }}>
                                Nhận xét (không bắt buộc)
                              </label>
                              <textarea
                                id={`comment-${player.playerId}`}
                                value={draft.comment}
                                maxLength={500}
                                rows={2}
                                onChange={(event) => updateDraft(player.playerId, { comment: event.target.value })}
                                style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, padding: 8 }}
                              />
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
                                {draft.comment.length}/500
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            )}

            {data.pendingPlayers.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={onClose} disabled={submitting}>
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  style={{
                    backgroundColor: 'var(--color-brand)',
                    color: '#FFFFFF',
                    borderRadius: 8,
                    padding: '8px 16px',
                    border: 'none',
                  }}
                >
                  {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
