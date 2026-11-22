import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, Clock, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
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
type Form = UseFormReturn<CourtFilterValues>;

interface CourtSearchFiltersProps {
  applied: CourtSearchState;
  onApply: (values: CourtFilterValues) => void;
  onReset: () => void;
}

function Field({ form, name, label, className, ...props }:
  { form: Form; name: keyof CourtFilterValues; label: string } & Omit<ComponentProps<typeof Input>, 'name' | 'form'> & { formId?: string }) {
  const error = form.formState.errors[name]?.message;
  const errorId = `court-${name}-error`;
  const { formId, 'aria-describedby': describedBy, ...inputProps } = props;
  return <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
    <Label htmlFor={`court-${name}`} className="text-xs font-semibold text-muted-foreground">{label}</Label>
    <Input id={`court-${name}`} form={formId} className="h-11 rounded-lg bg-card px-3 text-sm motion-safe:focus-visible:translate-y-0"
      {...inputProps} {...form.register(name)} aria-invalid={error ? true : undefined}
      aria-describedby={[describedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined} />
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

/** Search form; values are applied to the URL only on submit. Mobile moves date/time into a bottom sheet. */
export function CourtSearchFilters({ applied, onApply, onReset }: CourtSearchFiltersProps) {
  const today = todayIso();
  const schema = useMemo(() => courtFilterSchema(today), [today]);
  const { name, city, district, date, from, to } = applied;
  const form = useForm<CourtFilterValues>({ resolver: zodResolver(schema), defaultValues: { name, city, district, date, from, to } });
  const isDesktop = useMediaQuery('(min-width: 48rem)');
  const [sheetOpen, setSheetOpen] = useState(false);

  // Back/forward and links change the URL: show what is actually applied.
  useEffect(() => { form.reset({ name, city, district, date, from, to }); }, [form, name, city, district, date, from, to]);

  const submit = form.handleSubmit(values => { setSheetOpen(false); onApply(values); });
  const nameField = <Field form={form} name="name" label="Tên sân hoặc cơ sở" placeholder="VD: Phúc Thịnh, Sân 03" autoComplete="off" />;
  const area = <>
    <Field form={form} name="city" label="Tỉnh / Thành phố" placeholder="VD: Hồ Chí Minh" autoComplete="address-level1" aria-describedby={AREA_HINT_ID} />
    <Field form={form} name="district" label="Quận / Huyện" placeholder="VD: Gò Vấp" autoComplete="address-level2" aria-describedby={AREA_HINT_ID} />
  </>;
  const hint = <p id={AREA_HINT_ID} className="text-xs text-muted-foreground">Gõ một phần tên, có dấu — ví dụ “Gò Vấp”.</p>;
  const resetButton = <Button type="button" variant="ghost" className="h-11" onClick={() => { setSheetOpen(false); onReset(); }}>
    <RotateCcw aria-hidden="true" />Xóa lọc
  </Button>;

  return <form id={FORM_ID} role="search" aria-label="Tìm sân" noValidate onSubmit={submit}
    className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
    {isDesktop ? <>
      <div className="grid grid-cols-2 items-start gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_10rem_8rem_8rem_auto]">
        {nameField}
        {area}
        <WhenFields form={form} today={today} />
        <div className="col-span-2 flex gap-2 lg:col-span-1 lg:pt-6">
          <Button type="submit" className="h-11 flex-1 lg:flex-none"><Search aria-hidden="true" />Tìm sân</Button>
          {resetButton}
        </div>
      </div>
      {hint}
    </> : <>
      {nameField}
      <div className="grid grid-cols-2 gap-3">{area}</div>
      {hint}
      <div className="flex gap-2">
        <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" className="h-11 flex-1"><SlidersHorizontal aria-hidden="true" />Ngày & giờ</Button>
          </DialogTrigger>
          <DialogContent variant="sheet">
            <DialogTitle>Ngày và giờ chơi</DialogTitle>
            <DialogDescription>Chọn khung giờ để chỉ hiện sân còn trống trong khoảng đó.</DialogDescription>
            <div className="mt-5 grid grid-cols-2 gap-3 [&>*:first-child]:col-span-2">
              <WhenFields form={form} today={today} formId={FORM_ID} />
            </div>
            <div className="mt-6 flex gap-2">
              <Button type="submit" form={FORM_ID} variant="brand" className="h-12 flex-1">Áp dụng</Button>
              {resetButton}
            </div>
          </DialogContent>
        </Dialog>
        <Button type="submit" className="h-11 flex-1"><Search aria-hidden="true" />Tìm sân</Button>
      </div>
      <ul aria-label="Ngày và giờ đang áp dụng" className="flex flex-wrap gap-2">
        <li className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-medium">
          <CalendarDays aria-hidden="true" className="size-3.5" />{formatDay(date, today)}
        </li>
        {from && to && <li className="inline-flex min-h-9 items-center gap-1 rounded-full bg-success-bg pl-3 text-xs font-medium text-success">
          <Clock aria-hidden="true" className="size-3.5" />{from}–{to}
          <button type="button" aria-label={`Bỏ khung giờ ${from}–${to}`} onClick={() => onApply({ name, city, district, date, from: '', to: '' })}
            className="flex size-9 items-center justify-center rounded-full outline-none hover:bg-success/10 focus-visible:ring-2 focus-visible:ring-ring">
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </li>}
      </ul>
    </>}
  </form>;
}
