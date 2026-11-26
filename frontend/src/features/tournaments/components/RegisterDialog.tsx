import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, LoaderCircle, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { walletApi } from '@/features/wallet/services/wallet-api';
import { cn } from '@/shared/utils/cn';
import { feeLabel, formatDateTime, matchTypeLabel, money } from '../format';
import type { TournamentDetail } from '../types';

/** Registration confirmation (PRD FR-10/11): fee, wallet balance, balance after; short balance → top up. */
export function RegisterDialog({ tournament: t, open, onOpenChange, onConfirm, busy }: {
  tournament: TournamentDetail; open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; busy: boolean;
}) {
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: () => walletApi.getWallet(), enabled: open && t.entryFee > 0 });
  const available = wallet.data ? Number(wallet.data.available) : null;
  const after = available === null ? null : available - t.entryFee;
  const short = after !== null && after < 0;
  return <Dialog open={open} onOpenChange={value => !busy && onOpenChange(value)}>
    <DialogContent>
      <DialogTitle>Đăng ký giải</DialogTitle>
      <DialogDescription>{t.name} · {formatDateTime(t.tournamentStart)} · {matchTypeLabel(t.matchType)}</DialogDescription>
      {t.entryFee === 0
        ? <p className="mt-5 rounded-lg bg-success-bg px-4 py-3 text-sm text-success">Giải miễn phí — đăng ký được xác nhận ngay.</p>
        : <dl className="mt-5 grid gap-2 rounded-2xl bg-background p-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Lệ phí</dt><dd className="font-bold">{feeLabel(t.entryFee)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Số dư ví khả dụng</dt><dd>{available === null ? <Skeleton className="h-5 w-24" /> : money(available)}</dd></div>
          <div className="flex justify-between border-t border-dashed border-border pt-2 font-bold">
            <dt>Sau khi đăng ký</dt><dd className={cn(short && 'text-danger')}>{after === null ? '…' : short ? `Thiếu ${money(-after)}` : money(after)}</dd>
          </div>
        </dl>}
      {short
        ? <p className="mt-4 flex gap-2 rounded-lg bg-caution-bg px-3.5 py-3 text-sm text-caution"><AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />Ví chưa đủ tiền. Nạp thêm rồi quay lại đăng ký.</p>
        : t.entryFee > 0 && <p className="mt-4 text-sm text-muted-foreground">Lệ phí bị trừ ngay và đăng ký được xác nhận. Rút trước {formatDateTime(t.registrationEnd)} được hoàn 100% về ví.</p>}
      {renderRegistrationControls(onOpenChange, busy, short, t, onConfirm, after)}
    </DialogContent>
  </Dialog>;
}

function renderRegistrationControls(
  onOpenChange: (open: boolean) => void,
  busy: boolean,
  short: boolean,
  t: TournamentDetail,
  onConfirm: () => void,
  after: number | null,

) {
  return <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
    <Button type="button" variant="ghost" className="h-11" onClick={() => onOpenChange(false)} disabled={busy}>Huỷ</Button>
    {short
      ? <Button asChild className="h-11"><Link to={`/wallet?returnTo=${encodeURIComponent(`/tournaments/${t.id}`)}`}><Wallet aria-hidden="true" />Nạp ví</Link></Button>
      : <Button type="button" variant="brand" className="h-11" onClick={onConfirm} disabled={busy || (t.entryFee > 0 && after === null)}>
        {busy && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}{t.entryFee === 0 ? 'Xác nhận đăng ký' : `Xác nhận · ${feeLabel(t.entryFee)}`}
      </Button>}
  </div>;
}
