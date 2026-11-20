import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { focusDialogEdge } from '@/shared/utils/dialog-focus';
/** Admin dialogs retain explicit dismissal, initial content focus and existing lack of focus return. */
export function AdminDialog({ open, title, description, onClose, children }: { open: boolean; title: string; description?: ReactNode; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent ref={ref} showClose={false}
      className="z-1000 max-h-[90svh] max-w-2xl overflow-y-auto" overlayClassName="z-1000"
      onInteractOutside={e => e.preventDefault()} onOpenAutoFocus={e => { e.preventDefault(); ref.current?.focus(); }}
      onCloseAutoFocus={e => e.preventDefault()} onKeyDown={focusDialogEdge}>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : 'sr-only'}>{description || title}</DialogDescription>
        </div>
        <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Đóng" onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </div>
      {children}
    </DialogContent>
  </Dialog>;
}
export function AdminDialogFooter({ children }: { children: ReactNode }) { return <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-4">{children}</div>; }
