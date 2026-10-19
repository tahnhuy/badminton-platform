import { useEffect, useRef, useState } from 'react';
import { useModalA11y } from '../../../../shared/hooks/useModalA11y';
import { matchmakingService } from '../../services/matchmakingService';
import type { MatchDetail } from '../../types/matchmaking';
import { matchActionError, matchDate, matchTimeRange } from '../../utils/matchDetail';

interface Props { canSubmit: boolean; match: MatchDetail; onClose: () => void; onComplete: () => void; onConflict: () => void }

function useLeaveCommand({ match, onComplete, onConflict }: Props) {
  const lock = useRef(false);
  const active = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const leave = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await matchmakingService.leaveMatch(match.id); if (active.current) onComplete(); }
    catch (reason) { if (active.current) { setError(matchActionError(reason)); onConflict(); } }
    finally { lock.current = false; if (active.current) setBusy(false); }
  };
  return { busy, error, leave, lock };
}

export function LeaveMatchDialog(props: Props) {
  const { match, onClose, canSubmit } = props;
  const { busy, error, leave, lock } = useLeaveCommand(props);
  const close = () => { if (!lock.current) onClose(); };
  useEffect(() => {
    const opener = document.activeElement;
    return () => { if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
  }, []);
  const ref = useModalA11y<HTMLDivElement>(true, close);
  return <div className="match-dialog-backdrop" onClick={close}><div className="match-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-impact" aria-busy={busy} tabIndex={-1} ref={ref} onClick={event => event.stopPropagation()}>
    <span className="match-danger-label">XÁC NHẬN RỜI TRẬN</span><h2 id="leave-title">Bạn muốn rời trận #{match.id}?</h2>
    <p className="match-muted">{matchDate(match.scheduledAt)} · {matchTimeRange(match)}</p>
    <div className="match-warning" id="leave-impact"><strong>Rời trận sẽ hủy kèo cho cả nhóm.</strong><p>Những người còn lại cần tạo yêu cầu mới. Booking đã liên kết sẽ được yêu cầu hủy theo chính sách; việc hoàn tiền được xử lý riêng.</p></div>
    {error && <p role="alert" className="match-error">{error}</p>}
    <div className="match-dialog-actions"><button className="match-button match-button-secondary" disabled={busy} onClick={close}>Ở lại</button><button className="match-button match-button-danger" disabled={busy || !canSubmit} onClick={() => void leave()}>{busy ? 'Đang xử lý...' : 'Xác nhận rời trận'}</button></div>
  </div></div>;
}
