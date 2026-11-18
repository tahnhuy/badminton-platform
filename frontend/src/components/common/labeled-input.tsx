import type { ComponentProps, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/shared/utils/cn';

interface LabeledInputProps extends ComponentProps<typeof Input> {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
  endAdornment?: ReactNode;
}

/** A reusable labeled field; form registration/validation stay with the caller. */
export function LabeledInput({ id, label, icon: Icon, error, endAdornment, className, ...props }: LabeledInputProps) {
  const errorId = `${id}-error`;
  const describedBy = [props['aria-describedby'], error ? errorId : undefined].filter(Boolean).join(' ') || undefined;
  return <div className="space-y-2">
    <Label htmlFor={id} className="text-xs font-semibold">{label}</Label>
    <div className="relative">
      <Icon aria-hidden="true" className="pointer-events-none absolute left-4 top-4.5 size-4 text-muted-foreground" />
      <Input {...props} id={id} className={cn('pl-11', endAdornment && 'pr-12', className)}
        aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy} />
      {endAdornment}
    </div>
    {error && <p id={errorId} className="text-sm text-destructive">{error}</p>}
  </div>;
}
