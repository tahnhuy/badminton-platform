import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/shared/utils/cn';
import { focusDialogEdge } from '@/shared/utils/dialog-focus';
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
  const dialogRef = useRef<HTMLDivElement>(null);
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

    const items = collectSelectedRatings(data.pendingPlayers);
    if (!items) return;

    function collectSelectedRatings(players: (NonNullable<typeof data>)['pendingPlayers']): CreateRatingItem[] | undefined {
      const items: CreateRatingItem[] = [];
      for (const player of players) {
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
      return items;
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
    <Dialog open onOpenChange={open => { if (!open) close(); }}>
      <DialogContent overlayClassName="z-[1000]" ref={dialogRef} showClose={false} aria-busy={submitting} tabIndex={-1}
        onOpenAutoFocus={event => { event.preventDefault(); dialogRef.current?.focus(); }}
        onCloseAutoFocus={event => event.preventDefault()}
        onKeyDown={focusDialogEdge}
        className="z-[1000] max-h-[92dvh] max-w-3xl overflow-y-auto p-0">
        <header className="bg-primary bg-linear-to-br from-primary to-brand-hover p-5 text-primary-foreground sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold tracking-widest">SAU TRẬN ĐẤU · #{matchId}</span>
            <Button variant="ghost" size="icon" className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary-foreground outline-none hover:bg-primary-foreground/10 focus-visible:ring-2 focus-visible:ring-primary-foreground disabled:opacity-50" type="button" onClick={close} disabled={submitting} aria-label="Đóng">
              <X aria-hidden="true" className="size-5" />
            </Button>
          </div>
          <DialogTitle className="mt-3 text-2xl">Đánh giá người chơi sau trận</DialogTitle>
          <DialogDescription className="mt-2 text-primary-foreground/85">Ghi nhận kỹ năng và tinh thần thể thao của đồng đội, đối thủ.</DialogDescription>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-primary-foreground/85">
            {data && <span>{data.matchType === 'GROUP' ? 'Giao lưu' : data.matchType === 'SINGLES' ? 'Đấu đơn' : 'Đấu đôi'}</span>}
            {context && <span>{new Date(context.scheduledAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>}
            {context?.facilityName && <span>{context.facilityName}{context.courtName ? ` · ${context.courtName}` : ''}</span>}
          </div>
          {data && <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-semibold">
            <span>Đã gửi {data.ratedPlayers.length}/{total} người</span>
            <Progress aria-label="Tiến độ đánh giá" aria-valuetext={`Đã gửi ${data.ratedPlayers.length}/${total} người`} className="w-32 bg-primary-foreground/20 [&>div]:bg-primary-foreground" value={data.ratedPlayers.length / (total || 1) * 100} />
          </div>}
        </header>
        <div className="flex min-w-0 flex-col gap-5 p-5 sm:p-7">
          {loading && <p role="status">Đang tải...</p>}
          {loadError && <div role="alert" className="rounded-lg bg-danger-bg p-4 text-sm leading-6 text-danger"><p>{loadError}</p>
            <Button variant="outline" className="h-11" type="button" onClick={() => void load(true)}>Thử lại</Button></div>}
          {!loading && !loadError && data && <>
            {successMessage && <p role="status" className="rounded-lg bg-success-bg p-4 text-sm leading-6 text-success">{successMessage}</p>}
            {submitError && <p role="alert" className="rounded-lg bg-danger-bg p-4 text-sm leading-6 text-danger">{submitError}</p>}
            {fieldError && <p role="alert" className="rounded-lg bg-danger-bg p-4 text-sm leading-6 text-danger">{fieldError}</p>}
            {total === 0 && <p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Không có người chơi để đánh giá.</p>}
            {data.pendingPlayers.length > 0 && <fieldset disabled={submitting} className="min-w-0 border-0 disabled:opacity-75 [&_legend]:mb-2 [&_legend]:text-base [&_legend]:font-bold" aria-label="Người chơi cần đánh giá">
              <legend>Chọn người bạn muốn đánh giá</legend>
              <p className="text-xs leading-5 text-muted-foreground">Bạn có thể gửi cho từng người và tiếp tục vào lúc khác.</p>
              <ul className="mt-3 flex min-w-0 flex-col gap-3">{data.pendingPlayers.map(player => {
                const draft = drafts[player.playerId];
                if (!draft) return null;
                return <li key={player.playerId} className={cn('min-w-0 rounded-2xl border bg-card p-4 [overflow-wrap:anywhere]', draft.selected ? 'border-primary shadow-sm' : 'border-border')}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold [&_input]:size-4 [&_input]:shrink-0 [&_input]:accent-primary [&_input]:focus-visible:outline-2 [&_input]:focus-visible:outline-offset-3 [&_input]:focus-visible:outline-ring">
                    <input type="checkbox" checked={draft.selected}
                      onChange={event => updateDraft(player.playerId, { selected: event.target.checked })} />
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-bg font-bold text-primary" aria-hidden="true">{(player.fullName?.trim() || '?').slice(0, 1).toUpperCase()}</span>
                    <span>{player.fullName ?? `Người chơi #${player.playerId}`}</span>
                  </label>
                  {draft.selected && <div className="mt-4 flex flex-col gap-2 text-sm">
                    <div className="mb-2 grid gap-3 sm:grid-cols-2">
                      <StarRatingInput disabled={submitting} id={`skill-${player.playerId}`} label="Kỹ năng" value={draft.skill}
                        invalid={Boolean(fieldError) && draft.skill === null} onChange={value => updateDraft(player.playerId, { skill: value })} />
                      <StarRatingInput disabled={submitting} id={`attitude-${player.playerId}`} label="Thái độ" value={draft.attitude}
                        invalid={Boolean(fieldError) && draft.attitude === null} onChange={value => updateDraft(player.playerId, { attitude: value })} />
                    </div>
                    <label htmlFor={`comment-${player.playerId}`}>Nhận xét <span className="text-xs leading-5 text-muted-foreground">(không bắt buộc)</span></label>
                    <Textarea id={`comment-${player.playerId}`} value={draft.comment} maxLength={500} rows={3}
                      placeholder="Chia sẻ nhận xét công bằng, tôn trọng…"
                      onChange={event => updateDraft(player.playerId, { comment: event.target.value })} />
                    <span className="self-end text-xs text-muted-foreground">{draft.comment.length}/500</span>
                  </div>}
                </li>;
              })}</ul>
            </fieldset>}
            {data.pendingPlayers.length === 0 && total > 0 && <p className="rounded-lg bg-success-bg p-4 text-sm leading-6 text-success">Bạn đã đánh giá tất cả người chơi.</p>}
            {data.ratedPlayers.length > 0 && <section aria-label="Đánh giá đã gửi">
              <h3>Bạn đã đánh giá</h3>
              <ul className="mt-3 flex min-w-0 flex-col gap-3">{data.ratedPlayers.map(player => <li key={player.playerId} className="min-w-0 rounded-2xl border border-border bg-muted/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><strong>{player.fullName ?? `Người chơi #${player.playerId}`}</strong><span className="rounded-full bg-success-bg px-2.5 py-1 text-xs font-semibold text-success">Đã gửi</span></div>
                <div className="my-3 flex flex-wrap gap-x-6 gap-y-3 text-sm [&>span]:flex [&>span]:items-center [&>span]:gap-2">
                  <span>Kỹ năng <StarRatingDisplay value={player.rating.skillRating} label="Kỹ năng" /></span>
                  <span>Thái độ <StarRatingDisplay value={player.rating.attitudeRating} label="Thái độ" /></span>
                </div>
                {player.rating.comment && <p className="mb-2 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{player.rating.comment}</p>}
                <time className="text-xs leading-5 text-muted-foreground" dateTime={player.rating.createdAt}>{new Date(player.rating.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time>
              </li>)}</ul>
            </section>}
          </>}
          <aside className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground"><strong>Đánh giá công bằng & tôn trọng</strong>
            <p>Hai điểm theo thang 1–5. Đánh giá là tự nguyện và không thể sửa hoặc xóa sau khi gửi. Hãy ghi nhận trải nghiệm trong trận một cách công bằng và tôn trọng.</p>
          </aside>
        </div>
        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-4 shadow-sm sm:px-7 [&>div]:flex [&>div]:flex-wrap [&>div]:gap-2">
          <span className="text-xs leading-5 text-muted-foreground">{submitting ? 'Đang ghi nhận đánh giá, vui lòng chờ…' : `${selectedCount} người được chọn`}</span>
          <div><Button variant="outline" className="h-11" type="button" onClick={close} disabled={submitting}>Đóng</Button>
            {!loading && !loadError && Boolean(data?.pendingPlayers.length) && <Button className="h-11" type="button"
              onClick={() => void handleSubmit()} disabled={submitting}>{submitting ? 'Đang gửi...' : `Gửi đánh giá (${selectedCount} người)`}</Button>}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
