import { useId, type FormEvent } from 'react';
import type { Field } from './owner-fields';
export function OwnerForm({ fields, initial = {}, title, submit, busy, disabled }: { fields: Field[]; initial?: Record<string, unknown>; title: string; submit: (values: Record<string, unknown>) => void; busy?: boolean; disabled?: boolean }) {
  const prefix = useId();
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || disabled) return;
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(fields.map(field => {
      const value = String(form.get(field.name) ?? '').trim();
      return [field.name, field.type === 'number' ? Number(value) : value === '' && ['ward', 'validTo'].includes(field.name) ? null : value];
    }));
    submit(values);
  }
  return <form onSubmit={save} className="owner-form"><fieldset disabled={busy || disabled}>
    <div className="owner-fields">{fields.map(field => <label key={field.name} htmlFor={prefix + field.name}>{field.label}
      {field.type === 'textarea' ? <textarea id={prefix + field.name} name={field.name} required={field.required} defaultValue={String(initial[field.name] ?? '')} maxLength={5000} /> : <input id={prefix + field.name} name={field.name} type={field.type ?? 'text'} required={field.required} step={field.type === 'number' ? 'any' : undefined} defaultValue={String(initial[field.name] ?? '').slice(0, field.type === 'time' ? 5 : undefined)} />}
    </label>)}</div><button className="owner-primary" type="submit">{busy ? 'Đang lưu…' : title}</button>
  </fieldset></form>;
}
