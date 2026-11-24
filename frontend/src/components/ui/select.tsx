import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Select as Primitive } from 'radix-ui';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

/** Encode every value so empty options and caller strings cannot collide. */
const encodeValue = (value: string) => `option:${value}`;

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  ref?: Ref<HTMLButtonElement>;
  id?: string;
  name?: string;
  form?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  variant?: 'outline' | 'ghost';
  leadingIcon?: LucideIcon;
  className?: string;
  contentClassName?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

const triggerBase = 'group flex w-full min-w-0 items-center gap-2.5 rounded-lg text-left text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const triggerVariants: Record<NonNullable<SelectProps['variant']>, string> = {
  outline: 'h-11 border border-input bg-card px-3 hover:border-ring/40 focus-visible:ring-4 focus-visible:ring-ring/10 data-[state=open]:border-ring',
  ghost: 'h-10 px-3 hover:bg-primary/5 data-[state=open]:bg-primary/5',
};

const itemClass = 'relative flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-md py-2.5 pr-10 pl-3 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-soft data-[state=checked]:bg-primary/10 data-[state=checked]:font-semibold data-[state=checked]:text-primary';

export function Select({
  ref, id, name, form, value, defaultValue, onChange, onBlur, options, placeholder, disabled, required,
  variant = 'outline', leadingIcon: LeadingIcon, className, contentClassName,
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid,
}: SelectProps) {
  const initialValue = defaultValue ?? options[0]?.value ?? '';
  const [internalValue, setInternalValue] = useState(initialValue);
  const current = value ?? internalValue;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const formControlRef = useRef<HTMLSelectElement | null>(null);
  const selectedLabel = options.find(option => option.value === current)?.label;
  const change = (next: string) => {
    if (value === undefined) setInternalValue(next);
    onChange?.(next);
  };

  useEffect(() => {
    const ownerForm = formControlRef.current?.form;
    if (!ownerForm) return;
    const reset = (event: Event) => {
      window.setTimeout(() => {
        if (event.defaultPrevented) return;
        const next = value ?? initialValue;
        if (value === undefined) setInternalValue(next);
        // Native reset runs after the event; restore the bridge even when React state did not change.
        if (formControlRef.current) formControlRef.current.value = next;
      }, 0);
    };
    ownerForm.addEventListener('reset', reset);
    return () => ownerForm.removeEventListener('reset', reset);
  }, [initialValue, value, form]);

  return <>
    <Primitive.Root value={encodeValue(current)} onValueChange={next => change(next.slice('option:'.length))} disabled={disabled}>
      <Primitive.Trigger
        ref={node => {
          triggerRef.current = node;
          if (typeof ref === 'function') return ref(node);
          if (ref) ref.current = node;
        }}
        id={id}
        data-value={current}
        onBlur={onBlur}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        aria-required={required || undefined}
        className={cn(triggerBase, triggerVariants[variant], className)}
      >
        {LeadingIcon && <LeadingIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />}
        <span className={cn('min-w-0 flex-1 truncate', selectedLabel === undefined && 'text-muted-foreground')}>{selectedLabel ?? placeholder ?? ''}</span>
        <Primitive.Icon asChild>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          position="popper"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className={cn('z-1000 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none', contentClassName)}
        >
          <Primitive.ScrollUpButton className="flex h-6 items-center justify-center text-muted-foreground"><ChevronUp aria-hidden="true" className="size-4" /></Primitive.ScrollUpButton>
          <Primitive.Viewport>
            {options.map(option => <Primitive.Item
              key={option.value}
              value={encodeValue(option.value)}
              data-value={option.value}
              disabled={option.disabled}
              className={itemClass}
            >
              <Primitive.ItemText>{option.label}</Primitive.ItemText>
              <Primitive.ItemIndicator className="absolute right-3"><Check aria-hidden="true" className="size-4" /></Primitive.ItemIndicator>
            </Primitive.Item>)}
          </Primitive.Viewport>
          <Primitive.ScrollDownButton className="flex h-6 items-center justify-center text-muted-foreground"><ChevronDown aria-hidden="true" className="size-4" /></Primitive.ScrollDownButton>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
    {/* Keep real caller values and native constraint validation out of Radix's encoded values.
        This control is invisible; the Radix trigger remains the only interactive dropdown. */}
    <select ref={formControlRef} aria-hidden="true" tabIndex={-1} className="sr-only" name={name} form={form}
      value={current} disabled={disabled} required={required} onChange={event => change(event.target.value)}
      onInvalid={event => { event.preventDefault(); triggerRef.current?.focus(); }}>
      {!options.some(option => option.value === '') && <option value="" />}
      {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{typeof option.label === 'string' || typeof option.label === 'number' ? option.label : option.value}</option>)}
    </select>
  </>;
}
