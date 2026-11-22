import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useReturnFocus } from '@/shared/hooks/use-return-focus';

type Tone = 'danger' | 'success-soft' | 'caution-soft' | 'default';

/** Mount only while open: focus returns to the control that opened it. Closing is blocked while busy. */
export function ConfirmDialog({ title, description, children, error, busy, cancelLabel = 'Quay lại', confirmLabel, busyLabel, tone = 'default', onCancel, onConfirm }: {
  title: string; description: ReactNode; children?: ReactNode; error?: ReactNode; busy: boolean; cancelLabel?: string; confirmLabel: string; busyLabel?: string; tone?: Tone;
  onCancel: () => void; onConfirm: () => void;
}) {
  const returnFocus = useReturnFocus();
  return <Dialog open onOpenChange={open => { if (!open && !busy) onCancel(); }}>
    <DialogContent closeDisabled={busy} onCloseAutoFocus={returnFocus}>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription asChild><div className="mt-3 flex flex-col gap-2 leading-6">{description}</div></DialogDescription>
      {children}
      {error && <div role="alert" className="mt-4 rounded-lg bg-danger-bg p-3 text-sm text-danger">{error}</div>}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={onCancel}>{cancelLabel}</Button>
        <Button type="button" variant={tone} className="h-11" disabled={busy} onClick={onConfirm}>{busy && busyLabel ? busyLabel : confirmLabel}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
