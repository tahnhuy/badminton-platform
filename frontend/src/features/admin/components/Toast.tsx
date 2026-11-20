import { useEffect, useId, useRef } from 'react';
import { toast as notify } from 'sonner';
export interface ToastMessage { id: string; type: 'success' | 'error' | 'info'; message: string }
interface ToastProps { toasts: ToastMessage[]; onRemove: (id: string) => void }
/** Presentation adapter: caller still owns its existing 4-second timer and removal state. */
export function ToastContainer({ toasts, onRemove }: ToastProps) {
  const prefix = useId();
  const shown = useRef(new Map<string, string>());
  const remove = useRef(onRemove);
  useEffect(() => { remove.current = onRemove; }, [onRemove]);
  useEffect(() => {
    for (const message of toasts) {
      if (shown.current.has(message.id)) continue;
      const id = `${prefix}-${message.id}`;
      shown.current.set(message.id, id);
      notify[message.type](message.message, { id, duration: Infinity, position: 'bottom-right', closeButton: true, onDismiss: () => remove.current(message.id) });
    }
    const current = new Set(toasts.map(message => message.id));
    for (const [key, id] of shown.current) if (!current.has(key)) { notify.dismiss(id); shown.current.delete(key); }
  }, [toasts, prefix]);
  useEffect(() => { const entries = shown.current; return () => { for (const id of entries.values()) notify.dismiss(id); entries.clear(); }; }, []);
  return null;
}
