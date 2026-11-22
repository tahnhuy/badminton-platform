import { cn } from '@/shared/utils/cn';

interface ConfigRadioOptionProps {
  name: string;
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: () => void;
}

export function ConfigRadioOption({ name, checked, disabled, label, onChange }: ConfigRadioOptionProps) {
  return <label className={cn(
    'flex min-h-10 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
    checked ? 'border-primary bg-accent text-primary' : 'border-border bg-card text-foreground',
    disabled && 'cursor-not-allowed opacity-70',
  )}>
    <input type="radio" name={name} className="size-4 accent-primary" checked={checked} disabled={disabled} onChange={onChange} />
    <span>{label}</span>
  </label>;
}
