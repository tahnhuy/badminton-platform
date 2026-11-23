import { Star } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/shared/utils/cn';

interface StarRatingDisplayProps {
  value: number;
  label: string;
}

export function StarRatingDisplay({ value, label }: StarRatingDisplayProps) {
  return <span aria-label={`${label}: ${value}/5`} className="inline-flex items-center gap-1.5 text-primary">
    <span aria-hidden="true" className="inline-flex gap-0.5">{[1, 2, 3, 4, 5].map(score => <Star key={score} className={cn('size-3.5 shrink-0', score <= value ? 'fill-current' : 'text-muted-foreground/40')} />)}</span>
    <span aria-hidden="true" className="whitespace-nowrap text-xs font-semibold text-muted-foreground">{value}/5</span>
  </span>;
}

interface StarRatingInputProps {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  invalid?: boolean;
}

export function StarRatingInput({ id, label, value, onChange, disabled, invalid }: StarRatingInputProps) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/60 p-4">
      <span id={`${id}-label`} className="text-sm font-bold">{label}</span>
      <p className="text-xs leading-5 text-muted-foreground">{label === 'Kỹ năng' ? 'Khả năng chơi cầu trong trận' : 'Tinh thần thể thao và sự tôn trọng'}</p>
      <RadioGroup id={id} value={value === null ? '' : String(value)} onValueChange={score => onChange(Number(score))} disabled={disabled} aria-label={label} aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined} className="my-2 gap-0">
        {[1, 2, 3, 4, 5].map(score => (
          <RadioGroupItem key={score} value={String(score)}
            aria-label={`${label} ${score} trên 5`} disabled={disabled}
            tabIndex={score === (value ?? 1) ? 0 : -1}
            className={value !== null && score <= value ? 'text-primary' : 'text-muted-foreground'}
            onKeyDown={event => {
              const keys = ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End'];
              if (!keys.includes(event.key)) return;
              event.preventDefault();
              event.stopPropagation();
              const next = event.key === 'Home' ? 1 : event.key === 'End' ? 5
                : ((score - 1 + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : 4)) % 5) + 1;
              onChange(next);
              const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
              buttons?.[next - 1]?.focus();
            }}>
            <Star aria-hidden="true" className={cn('size-6', value !== null && score <= value && 'fill-current')} />
          </RadioGroupItem>
        ))}
      </RadioGroup>
      <span className="text-xs leading-5 text-muted-foreground">{value === null ? 'Chưa chọn' : `${value}/5`}</span>
      {invalid && <p id={`${id}-error`} className="mt-2 text-xs text-danger">Chọn điểm {label.toLowerCase()} từ 1 đến 5.</p>}
    </div>
  );
}
