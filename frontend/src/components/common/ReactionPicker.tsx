import { REACTIONS, type ReactionType } from './reactions';
export function ReactionPicker({ value, disabled, onChange }: { value: string | null; disabled?: boolean; onChange: (type: ReactionType | null) => void }) {
  return <div className="community-reactions" role="group" aria-label="Cảm xúc bài viết">{REACTIONS.map(r => <button key={r.type} type="button" title={r.label} aria-label={r.label} aria-pressed={value === r.type} disabled={disabled} onClick={() => onChange(value === r.type ? null : r.type)}>{r.emoji}</button>)}</div>;
}
