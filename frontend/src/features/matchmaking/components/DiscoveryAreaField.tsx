import { useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/shared/utils/cn';

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
export const citySuggestions = ['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng', 'Bình Dương', 'Đồng Nai'];
export const districtSuggestions = ['Gò Vấp', 'Tân Bình', 'Bình Thạnh', 'Phú Nhuận', 'Quận 1', 'Quận 3', 'Quận 7', 'Quận 10', 'Quận 12', 'Tân Phú', 'Bình Tân', 'Thủ Đức', 'Cầu Giấy', 'Đống Đa', 'Thanh Xuân', 'Hai Bà Trưng'];

/** Suggestions are shortcuts; arbitrary owner-entered locations remain searchable. */
export function DiscoveryAreaField({ id, label, value, onChange, suggestions, placeholder, icon: Icon }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  suggestions: string[]; placeholder: string; icon: LucideIcon;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const options = suggestions.filter(item => normalize(item).includes(normalize(value.trim()))).slice(0, 8);
  const choose = (text: string) => { onChange(text); setOpen(false); setActive(-1); input.current?.focus(); };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      setActive(previous => event.key === 'ArrowDown' ? Math.min(previous + 1, options.length - 1) : Math.max(previous - 1, 0));
    } else if (event.key === 'Enter' && open && active >= 0 && options[active]) {
      event.preventDefault(); choose(options[active]);
    } else if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); setActive(-1); }
  };
  return <div ref={container} className="relative flex min-w-0 flex-col justify-center gap-1.5" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setActive(-1); }
  }}>
    <Label htmlFor={id} className="pl-3 text-xs font-semibold text-muted-foreground">{label}</Label>
    <div className="relative">
      {/* Keep the field icon above the input: the focused Input paints an opaque
          background and would otherwise cover it. */}
      <Icon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input ref={input} id={id} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`}
        aria-activedescendant={open && active >= 0 && options[active] ? `${id}-option-${active}` : undefined}
        className="h-10 rounded-lg border-0 bg-transparent pl-9 pr-10 text-sm hover:bg-soft motion-safe:focus-visible:translate-y-0"
        value={value} maxLength={100} placeholder={placeholder} onKeyDown={keyDown}
        onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }} />
      <button type="button" aria-label={`Gợi ý ${label}`} className="absolute right-0.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => { setOpen(previous => !previous); setActive(-1); }}><ChevronDown aria-hidden="true" className="size-4" /></button>
    </div>
    {open && <div className="absolute inset-x-0 top-full z-50 mt-2 rounded-xl border border-border bg-popover p-1.5 shadow-lg">
      <div id={`${id}-options`} role="listbox" aria-label={`Gợi ý ${label}`} className="max-h-64 overflow-y-auto">
        {options.map((option, index) => <button key={option} id={`${id}-option-${index}`} type="button" role="option" aria-selected={option === value}
          className={cn('flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm outline-none hover:bg-soft focus-visible:ring-2 focus-visible:ring-ring', active === index && 'bg-soft')}
          onPointerDown={event => event.preventDefault()} onClick={() => choose(option)}><span>{option}</span>{option === value && <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />}</button>)}
        {!options.length && <p className="px-3 py-2 text-xs text-muted-foreground">Không có gợi ý. Bạn vẫn có thể nhập địa danh khác.</p>}
      </div>
    </div>}
  </div>;
}
