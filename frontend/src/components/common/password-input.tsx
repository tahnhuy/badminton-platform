import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff, LockKeyhole, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LabeledInput } from './labeled-input';

interface PasswordInputProps extends Omit<ComponentProps<typeof LabeledInput>, 'type' | 'endAdornment' | 'icon'> {
  /** Lower-case field name used in the toggle label, e.g. "mật khẩu mới". */
  toggleLabel: string;
  icon?: LucideIcon;
}

/** Labeled password field with a keyboard-reachable show/hide toggle. */
export function PasswordInput({ id, toggleLabel, icon = LockKeyhole, disabled, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return <LabeledInput id={id} icon={icon} type={visible ? 'text' : 'password'} disabled={disabled} {...props}
    endAdornment={<Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1" disabled={disabled}
      onClick={() => setVisible(value => !value)} aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${toggleLabel}`}
      aria-pressed={visible} aria-controls={id}>
      {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </Button>} />;
}
