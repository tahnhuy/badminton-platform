import '../ratings.css';

interface StarRatingDisplayProps {
  value: number;
  label: string;
}

export function StarRatingDisplay({ value, label }: StarRatingDisplayProps) {
  return (
    <span aria-label={`${label}: ${value}/5`} style={{ color: 'var(--color-brand)', letterSpacing: 1 }}>
      <span aria-hidden="true">{'★'.repeat(value)}</span>
      <span aria-hidden="true" style={{ color: 'var(--text-secondary)' }}>{'☆'.repeat(5 - value)}</span>
      <span aria-hidden="true" className="rating-numeric"> {value}/5</span>
    </span>
  );
}

interface StarRatingInputProps {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  invalid?: boolean;
}

export function StarRatingInput({ id, label, value, onChange, disabled, invalid }: StarRatingInputProps) {
  return (
    <div className="rating-dimension">
      <span id={`${id}-label`} className="rating-dimension-label">{label}</span>
      <p className="rating-muted">{label === 'Kỹ năng' ? 'Khả năng chơi cầu trong trận' : 'Tinh thần thể thao và sự tôn trọng'}</p>
      <div id={id} role="radiogroup" aria-label={label} aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined} className="rating-stars">
        {[1, 2, 3, 4, 5].map(score => (
          <button key={score} type="button" role="radio" aria-checked={value === score}
            aria-label={`${label} ${score} trên 5`} disabled={disabled}
            tabIndex={score === (value ?? 1) ? 0 : -1}
            className={`rating-star ${value !== null && score <= value ? 'is-active' : ''}`}
            onClick={() => onChange(score)}
            onKeyDown={event => {
              const keys = ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End'];
              if (!keys.includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home' ? 1 : event.key === 'End' ? 5
                : ((score - 1 + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : 4)) % 5) + 1;
              onChange(next);
              const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
              buttons?.[next - 1]?.focus();
            }}>
            <span aria-hidden="true">{value !== null && score <= value ? '★' : '☆'}</span>
          </button>
        ))}
      </div>
      <span className="rating-muted">{value === null ? 'Chưa chọn' : `${value}/5`}</span>
      {invalid && <p id={`${id}-error`} className="rating-field-error">Chọn điểm {label.toLowerCase()} từ 1 đến 5.</p>}
    </div>
  );
}
