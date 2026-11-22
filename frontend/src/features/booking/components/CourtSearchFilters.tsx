import { useEffect, useMemo, useRef, useState, type ComponentProps, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, CalendarDays, Check, ChevronDown, Clock3, MapPin, Search, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { cn } from '@/shared/utils/cn';
import { todayIso } from '../utils/booking';
import { courtFilterSchema, type CourtFilterValues, type CourtSearchState } from '../utils/courtSearch';

const FORM_ID = 'court-search-form';
const AREA_HINT_ID = 'court-area-hint';
const LIVE_DELAY_MS = 400;
const INPUT_CLASS = 'h-10 rounded-lg border-0 bg-transparent px-3 text-sm hover:bg-soft motion-safe:focus-visible:translate-y-0';
/** Quick suggestions only; the area fields stay free text so every owner-entered location remains searchable. */
const CITY_SUGGESTIONS = ['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng', 'Bình Dương', 'Đồng Nai'];
const DISTRICT_SUGGESTIONS = ['Gò Vấp', 'Tân Bình', 'Bình Thạnh', 'Phú Nhuận', 'Quận 1', 'Quận 3', 'Quận 7', 'Quận 10', 'Quận 12', 'Tân Phú', 'Bình Tân', 'Thủ Đức', 'Cầu Giấy', 'Đống Đa', 'Thanh Xuân', 'Hai Bà Trưng'];
type Form = UseFormReturn<CourtFilterValues>;

const normalizeText = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

interface CourtSearchFiltersProps {
  applied: CourtSearchState;
  onApply: (values: CourtFilterValues, options?: { replace?: boolean }) => void;
  onReset: () => void;
}

interface FieldProps {
  form: Form;
  name: keyof CourtFilterValues;
  label: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
  formId?: string;
}

function Field({ form, name, label, icon: Icon, trailing, className, ...props }: FieldProps & Omit<ComponentProps<typeof Input>, 'name' | 'form'>) {
  const error = form.formState.errors[name]?.message;
  const errorId = `court-${name}-error`;
  const { formId, 'aria-describedby': describedBy, ...inputProps } = props;
  return <div className={cn('flex min-w-0 flex-col gap-1', className)}>
    <Label htmlFor={`court-${name}`} className="text-xs font-semibold text-muted-foreground">{label}</Label>
    <div className="relative">
      {Icon && <Icon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />}
      <Input id={`court-${name}`} form={formId} className={cn(INPUT_CLASS, Icon && 'pl-9', trailing && 'pr-11')}
        {...inputProps} {...form.register(name)} aria-invalid={error ? true : undefined}
        aria-describedby={[describedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined} />
      {trailing}
    </div>
    {error && <p id={errorId} className="text-xs text-destructive">{error}</p>}
  </div>;
}

/** Free-text typeahead for area filters: suggestions narrow as the user types, and any location can still be entered. */
function AreaField({ form, name, label, icon: Icon, suggestions, className, ...props }: FieldProps & { suggestions: string[] } & Omit<ComponentProps<typeof Input>, 'name' | 'form'>) {
  const error = form.formState.errors[name]?.message;
  const errorId = `court-${name}-error`;
  const listId = `court-${name}-listbox`;
  const { formId, 'aria-describedby': describedBy, ...inputProps } = props;
  const value = (form.watch(name) as string) ?? '';
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const registration = form.register(name);
  const needle = normalizeText(value.trim());
  const options = (needle ? suggestions.filter(option => normalizeText(option).includes(needle)) : suggestions).slice(0, 8);
  const optionId = (index: number) => `court-${name}-option-${index}`;

  const select = (option: string) => {
    form.setValue(name, option, { shouldDirty: true });
    setOpen(false);
    setActive(-1);
    form.setFocus(name);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { setOpen(true); setActive(event.key === 'ArrowDown' ? 0 : Math.max(options.length - 1, 0)); return; }
      setActive(current => event.key === 'ArrowDown' ? Math.min(current + 1, options.length - 1) : Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && open) {
      if (active >= 0 && options[active]) { event.preventDefault(); select(options[active]); }
      else setOpen(false);
    } else if (event.key === 'Escape') {
      setOpen(false); setActive(-1);
    }
  };

  return <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
    <Label htmlFor={`court-${name}`} className="text-xs font-semibold text-muted-foreground">{label}</Label>
    <div className="relative" ref={containerRef}>
      {Icon && <Icon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />}
      <Input id={`court-${name}`} form={formId} className={cn(INPUT_CLASS, 'pl-9 pr-9')}
        {...inputProps} {...registration} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={[describedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined}
        onInput={() => { setOpen(true); setActive(-1); }}
        onKeyDown={onKeyDown}
        onBlur={event => { registration.onBlur(event); window.setTimeout(() => { if (!containerRef.current?.contains(document.activeElement)) setOpen(false); }, 0); }} />
      <Button type="button" variant="ghost" size="icon" className="absolute right-0.5 top-1/2 size-9 -translate-y-1/2" aria-label={`Gợi ý ${label}`}
        onClick={() => { setOpen(current => !current); setActive(-1); }}>
        <ChevronDown aria-hidden="true" />
      </Button>
      {open && <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover p-1.5 shadow-lg">
        <div id={listId} role="listbox" aria-label={`Gợi ý ${label}`} className="max-h-64 overflow-y-auto">
          {options.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Không có gợi ý — vẫn gõ được địa danh khác.</p>}
          {options.map((option, index) => <button key={option} id={optionId(index)} type="button" role="option" aria-selected={option === value}
            className={cn('flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-sm font-medium text-foreground outline-none transition-colors hover:bg-soft focus-visible:ring-2 focus-visible:ring-ring', index === active && 'bg-soft')}
            onPointerDown={event => event.preventDefault()}
            onClick={() => select(option)}>
            <span className="min-w-0 flex-1 truncate">{option}</span>
            {option === value && <Check aria-hidden="true" className="size-4 text-primary" />}
          </button>)}
        </div>
      </div>}
    </div>
    {error && <p id={errorId} className="text-xs text-destructive">{error}</p>}
  </div>;
}

const formatDay = (iso: string, today: string) => (iso === today ? 'Hôm nay' : iso.split('-').reverse().join('/'));

function WhenFields({ form, today, formId }: { form: Form; today: string; formId?: string }) {
  return <>
    <Field form={form} name="date" label="Ngày chơi" type="date" min={today} required formId={formId} />
    <Field form={form} name="from" label="Từ giờ" type="time" formId={formId} />
    <Field form={form} name="to" label="Đến giờ" type="time" formId={formId} />
  </>;
}

/** Text filters apply live; date/time confirm through the responsive dialog. */
export function CourtSearchFilters({ applied, onApply, onReset }: CourtSearchFiltersProps) {
  const today = todayIso();
  const schema = useMemo(() => courtFilterSchema(today), [today]);
  const { name, city, district, date, from, to } = applied;
  const form = useForm<CourtFilterValues>({ resolver: zodResolver(schema), defaultValues: { name, city, district, date, from, to } });
  const isDesktop = useMediaQuery('(min-width: 48rem)');
  const [sheetOpen, setSheetOpen] = useState(false);
  const watchedName = form.watch('name');
  const watchedCity = form.watch('city');
  const watchedDistrict = form.watch('district');
  const appliedRef = useRef(applied);
  const onApplyRef = useRef(onApply);
  appliedRef.current = applied;
  onApplyRef.current = onApply;

  // Back/forward and links change the URL: show what is actually applied (keep in-progress spacing while typing).
  useEffect(() => {
    const current = form.getValues();
    const sameText = current.name.trim() === name && current.city.trim() === city && current.district.trim() === district;
    if (sameText && current.date === date && current.from === from && current.to === to) return;
    form.reset({ name, city, district, date, from, to });
  }, [form, name, city, district, date, from, to]);

  // Live search for the free-text filters; date/time still submit explicitly so a half-typed window is never sent.
  useEffect(() => {
    const text = (value: string) => value.trim();
    const unchanged = text(watchedName) === text(appliedRef.current.name)
      && text(watchedCity) === text(appliedRef.current.city)
      && text(watchedDistrict) === text(appliedRef.current.district);
    if (unchanged) return;
    const timer = window.setTimeout(() => {
      const parsed = schema.safeParse(form.getValues());
      if (parsed.success) onApplyRef.current(parsed.data, { replace: true });
    }, LIVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [watchedName, watchedCity, watchedDistrict, form, schema]);

  const submit = form.handleSubmit(values => { setSheetOpen(false); onApply(values); });
  const nameField = <Field form={form} name="name" label="Tên sân hoặc cơ sở" className="[&>label]:pl-3" placeholder="VD: Phúc Thịnh" autoComplete="off" icon={Search}
    trailing={watchedName && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-10" aria-label="Xóa tên sân đang tìm"
      onClick={() => { form.setValue('name', '', { shouldDirty: true }); form.setFocus('name'); }}><X aria-hidden="true" /></Button>} />;
  const area = <>
    <AreaField form={form} name="city" label="Tỉnh / Thành phố" placeholder="Hồ Chí Minh" autoComplete="address-level1" aria-describedby={AREA_HINT_ID} icon={MapPin} suggestions={CITY_SUGGESTIONS} />
    <AreaField form={form} name="district" label="Quận / Huyện" placeholder="Gò Vấp" autoComplete="address-level2" aria-describedby={AREA_HINT_ID} icon={Building2} suggestions={DISTRICT_SUGGESTIONS} />
  </>;
  const removeFilter = (key: 'name' | 'city' | 'district' | 'date' | 'window') => {
    const next = { name, city, district, date, from, to };
    if (key === 'window') { next.from = ''; next.to = ''; }
    else next[key] = key === 'date' ? today : '';
    onApply(next);
  };
  const chips = [
    { key: 'date' as const, label: formatDay(date, today), removable: date !== today },
    ...(from && to ? [{ key: 'window' as const, label: `${from}–${to}`, removable: true }] : []),
    ...(['name', 'city', 'district'] as const).filter(key => applied[key]).map(key => ({ key, label: applied[key], removable: true })),
  ];

  return <form id={FORM_ID} role="search" aria-label="Tìm sân" noValidate onSubmit={submit} className="flex min-w-0 flex-col gap-3">
    <div className="grid min-w-0 gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-sm transition-shadow focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 min-[861px]:grid-cols-[1.3fr_1.5fr_1fr] min-[861px]:gap-0 min-[861px]:rounded-full min-[861px]:p-1">
      <div className="min-w-0 rounded-lg border border-border bg-soft px-3 py-1.5 min-[861px]:rounded-full min-[861px]:border-0 min-[861px]:bg-transparent min-[861px]:px-6 min-[861px]:hover:bg-soft">
        {nameField}
      </div>
      <div className="min-w-0 rounded-lg border border-border bg-soft px-3 py-1.5 min-[861px]:rounded-none min-[861px]:border-0 min-[861px]:border-l min-[861px]:bg-transparent min-[861px]:px-4">
        <p className="sr-only">Khu vực</p>
        <div className="grid min-w-0 grid-cols-2 gap-2">{area}</div>
      </div>
      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogTrigger asChild>
          <button type="button" aria-label="Ngày & giờ" className="flex min-w-0 flex-col justify-center gap-1 rounded-lg border border-border bg-soft px-4 py-2 text-left outline-none hover:bg-soft focus-visible:ring-2 focus-visible:ring-ring min-[861px]:rounded-full min-[861px]:border-0 min-[861px]:bg-transparent">
            <span className="text-xs font-semibold text-muted-foreground">Ngày & giờ</span>
            <span className="flex w-full min-w-0 items-center gap-2 text-sm font-semibold">
              <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">{formatDay(date, today)}{from && to ? ` · ${from}–${to}` : ''}</span>
              <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
            </span>
          </button>
        </DialogTrigger>
        <DialogContent variant={isDesktop ? 'center' : 'sheet'}>
          <DialogTitle>Ngày và giờ chơi</DialogTitle>
          <DialogDescription>Chọn khung giờ để chỉ hiện sân còn trống trong khoảng đó.</DialogDescription>
          <div className="mt-5 grid grid-cols-2 gap-3 [&>*:first-child]:col-span-2">
            <WhenFields form={form} today={today} formId={FORM_ID} />
          </div>
          <div className="mt-6 flex gap-2">
            <Button type="submit" form={FORM_ID} variant="brand" className="h-12 flex-1">Áp dụng</Button>
            <Button type="button" variant="ghost" className="h-12" onClick={() => setSheetOpen(false)}>Hủy</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    <p id={AREA_HINT_ID} className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
      Kết quả cập nhật ngay khi bạn gõ. Gõ một phần tên, có dấu — ví dụ “Gò Vấp”.
    </p>
    <div className="flex flex-wrap items-center gap-2" aria-label="Bộ lọc đang áp dụng">
      <span className="text-xs text-muted-foreground">Đang lọc:</span>
      <ul aria-label="Ngày và giờ đang áp dụng" className="flex min-w-0 flex-wrap gap-2">
        {chips.map(chip => <li key={chip.key} className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-full border border-border bg-card pl-3 pr-2 text-xs font-medium">
          {chip.key === 'window' && <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />}
          <span className="break-words [overflow-wrap:anywhere]">{chip.label}</span>
          {chip.removable && <button type="button" aria-label={chip.key === 'window' ? `Bỏ khung giờ ${chip.label}` : `Bỏ lọc ${chip.label}`}
            onClick={() => removeFilter(chip.key)} className="flex size-9 shrink-0 items-center justify-center rounded-full outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            <X aria-hidden="true" className="size-3.5" />
          </button>}
        </li>)}
      </ul>
      <Button type="button" variant="ghost" className="h-9 text-xs text-muted-foreground" onClick={() => { setSheetOpen(false); onReset(); }}>Xóa tất cả</Button>
    </div>
  </form>;
}
