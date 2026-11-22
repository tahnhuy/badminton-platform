import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useId, useState, type ReactNode } from 'react';
import { AdminDialog, AdminDialogFooter } from './AdminDialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export interface PromptDialogProps {
  title: string;
  description?: ReactNode;
  label: string;
  required?: boolean;
  requiredMessage?: string;
  confirmLabel: string;
  busyLabel?: string;
  tone?: 'default' | 'brand' | 'danger' | 'danger-soft';
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  initialValue?: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Không thể thực hiện thao tác.';
}

/** Admin note/reason prompt. Mount it only while open so the field always starts fresh. */
export function PromptDialog({
  title,
  description,
  label,
  required = false,
  requiredMessage,
  confirmLabel,
  busyLabel = 'Đang xử lý...',
  tone = 'default',
  multiline = false,
  maxLength,
  placeholder,
  initialValue = '',
  onClose,
  onSubmit,
}: PromptDialogProps) {
  const id = useId();
  const schema = z.object({ value: z.string().trim().min(required ? 1 : 0, requiredMessage ?? `Vui lòng nhập ${label.toLowerCase()}.`).max(maxLength ?? Number.MAX_SAFE_INTEGER) });
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: { value: initialValue } });
  const fieldError = errors.value?.message;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (!busy) onClose();
  };

  const submit = handleSubmit(async ({ value: trimmed }) => {
    setError('');
    setBusy(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  });

  return <AdminDialog open title={title} description={description} onClose={close} allowEscape={!busy}>
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Alert variant="destructive">{error}</Alert>}
      <label htmlFor={id} className="flex flex-col gap-1 text-sm font-semibold">
        <span>{label}{required && <span aria-hidden="true"> *</span>}</span>
        {multiline
          ? <Textarea id={id} {...register('value')}
              maxLength={maxLength} placeholder={placeholder} disabled={busy} aria-invalid={Boolean(fieldError)} autoComplete="off" />
          : <Input id={id} {...register('value')}
              maxLength={maxLength} placeholder={placeholder} disabled={busy} aria-invalid={Boolean(fieldError)} autoComplete="off" />}
      </label>
      {fieldError && <p role="alert" className="text-sm text-destructive">{fieldError}</p>}
      <AdminDialogFooter>
        <Button type="button" variant="outline" onClick={close} disabled={busy}>Hủy</Button>
        <Button type="submit" variant={tone} disabled={busy}>{busy ? busyLabel : confirmLabel}</Button>
      </AdminDialogFooter>
    </form>
  </AdminDialog>;
}
