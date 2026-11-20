import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useReturnFocus } from '@/shared/hooks/use-return-focus';
import { AlertTriangle } from 'lucide-react';
import { matchmakingService } from '../../services/matchmakingService';
import type { MatchDetail } from '../../types/matchmaking';
import { matchActionError, matchDate, matchTimeRange, matchLeaveImpact } from '../../utils/matchDetail';

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
  const returnFocus = useReturnFocus();
  const impact = matchLeaveImpact(match);
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent overlayClassName="z-[1000]" className="z-[1000]" showClose={false} aria-busy={busy} onCloseAutoFocus={returnFocus}>
      <span className="mb-3 flex items-center gap-2 text-xs font-bold tracking-widest text-danger"><AlertTriangle aria-hidden="true" className="size-4" />XÁC NHẬN RỜI TRẬN</span>
      <DialogTitle>Bạn muốn rời trận #{match.id}?</DialogTitle>
      <p className="mt-2 text-sm text-muted-foreground">{matchDate(match.scheduledAt)} · {matchTimeRange(match)}</p>
      <DialogDescription asChild><div className="mt-5 rounded-lg bg-caution-bg p-4 text-sm leading-6 text-caution"><strong>{impact.summary}</strong><p className="mt-2">{impact.detail}</p></div></DialogDescription>
      {error && <p role="alert" className="mt-4 rounded-lg bg-danger-bg p-4 text-sm text-danger">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-2"><Button variant="outline" className="h-11" disabled={busy} onClick={close}>Ở lại</Button><Button variant="danger" className="h-11" disabled={busy || !canSubmit} onClick={() => void leave()}>{busy ? 'Đang xử lý...' : 'Xác nhận rời trận'}</Button></div>
    </DialogContent>
  </Dialog>;
}
