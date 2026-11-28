import { MoneyPreview } from '@/components/common/money-preview';
import { useId, useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { Field } from './owner-fields';
export function OwnerForm({ fields, initial = {}, title, submit, busy, disabled }: { fields: Field[]; initial?: Record<string, unknown>; title: string; submit: (values: Record<string, unknown>) => void; busy?: boolean; disabled?: boolean }) {
  const prefix = useId();
  const [moneyDrafts, setMoneyDrafts] = useState<Record<string, string>>({});
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || disabled) return;
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(fields.map(field => {
      const value = String(form.get(field.name) ?? '').trim();
      return [field.name, field.type === 'number' ? Number(value) : value === '' && ['ward', 'validTo'].includes(field.name) ? null : value];
    }));
    submit(values);
  }
  return <form onSubmit={save} className="flex min-w-0 flex-col gap-4"><fieldset className="flex min-w-0 flex-col gap-5 disabled:opacity-75" disabled={busy || disabled}>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">{fields.map(field => <div key={field.name} className={field.type === 'textarea' ? 'flex min-w-0 flex-col gap-2 sm:col-span-2' : 'flex min-w-0 flex-col gap-2'}><Label htmlFor={prefix + field.name} className="text-sm font-semibold">{field.label}{field.required && <span aria-hidden="true" className="text-destructive"> *</span>}</Label>
      {field.type === 'textarea' ? <Textarea id={prefix + field.name} name={field.name} aria-label={field.label} required={field.required} defaultValue={String(initial[field.name] ?? '')} maxLength={5000} /> : <Input className="h-11 rounded-lg bg-card px-3 text-sm motion-safe:focus-visible:translate-y-0" id={prefix + field.name} name={field.name} aria-label={field.label} onChange={field.money ? event => setMoneyDrafts(current => ({ ...current, [field.name]: event.target.value })) : undefined} type={field.type ?? 'text'} required={field.required} step={field.type === 'number' ? 'any' : undefined} defaultValue={String(initial[field.name] ?? '').slice(0, field.type === 'time' ? 5 : undefined)} />}
      {field.money && <MoneyPreview value={moneyDrafts[field.name] ?? String(initial[field.name] ?? '')} suffix="/giờ" />}
    </div>)}</div><Button className="h-11 self-start" type="submit">{busy ? 'Đang lưu…' : title}</Button>
  </fieldset></form>;
}
