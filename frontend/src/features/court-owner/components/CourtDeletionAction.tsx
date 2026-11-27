import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useOwnerAction } from '../hooks/useOwnerAction';
import { ownerApi } from '../services/owner-api';
import type { Court } from '../types/owner';
import { Feedback } from './OwnerUi';

export function CourtDeletionAction({ court, changed }: { court: Court; changed: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const action = useOwnerAction();
  if (court.pendingDeletionReview) return <div className="max-w-64 whitespace-normal text-sm"><strong className="text-caution">Đang chờ duyệt xóa</strong><p className="mt-1 text-xs text-muted-foreground">Lý do: {String(court.pendingDeletionReview.submittedValues.reason ?? '')}</p></div>;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) return;
    void action.run(() => ownerApi.write(`/courts/${court.id}/deletion-requests`, { reason: reason.trim() }), () => { setOpen(false); setReason(''); changed(); });
  };
  return <>
    <Button type="button" variant="danger-soft" className="h-11" disabled={court.status === 'PENDING_APPROVAL'} onClick={() => setOpen(true)}><Trash2 aria-hidden="true" />Yêu cầu xóa sân</Button>
    <Dialog open={open} onOpenChange={value => { if (!action.busy) setOpen(value); }}>
      <DialogContent closeDisabled={action.busy} aria-describedby={`court-deletion-description-${court.id}`}>
        <DialogTitle>Yêu cầu xóa sân: {court.name}</DialogTitle>
        <p id={`court-deletion-description-${court.id}`} className="mt-3 text-sm leading-6 text-muted-foreground">Sân vẫn hoạt động trong lúc chờ Admin duyệt. Admin chỉ có thể duyệt xóa khi không còn booking sắp diễn ra hoặc đang chơi. Lịch sử đặt sân và giao dịch được giữ lại.</p>
        <form className="mt-5 grid gap-4" onSubmit={submit}>
          <div className="grid gap-2"><Label htmlFor={`court-deletion-reason-${court.id}`}>Lý do xóa sân</Label><Textarea id={`court-deletion-reason-${court.id}`} value={reason} onChange={event => setReason(event.target.value)} required maxLength={1000} disabled={action.busy} placeholder="Nhập lý do để Admin xem xét" /></div>
          <Feedback {...action} />
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={action.busy} onClick={() => setOpen(false)}>Hủy</Button><Button type="submit" variant="danger-soft" disabled={action.busy || !reason.trim()}>{action.busy ? 'Đang gửi…' : 'Gửi yêu cầu xóa'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
