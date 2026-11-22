import { cn } from '@/shared/utils/cn';
import { REACTIONS, type ReactionType } from './reactions';

export function ReactionPicker({ value, disabled, onChange }: { value: string | null; disabled?: boolean; onChange: (type: ReactionType | null) => void }) {
  return <div role="group" aria-label="Cảm xúc bài viết" className="flex w-fit flex-wrap gap-1 rounded-full border border-border bg-card p-1.5 shadow-sm">
    {REACTIONS.map(r => <button key={r.type} type="button" title={r.label} aria-label={r.label} aria-pressed={value === r.type} disabled={disabled} onClick={() => onChange(value === r.type ? null : r.type)}
      className={cn('flex size-10 items-center justify-center rounded-full text-2xl transition-transform duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 motion-safe:hover:scale-110 motion-reduce:transition-none',
        value === r.type && 'bg-success-bg ring-2 ring-primary')}>{r.emoji}</button>)}
  </div>;
}
