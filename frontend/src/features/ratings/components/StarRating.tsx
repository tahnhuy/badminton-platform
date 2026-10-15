const ERROR_COLOR = 'var(--color-danger)';

interface StarRatingDisplayProps {
  value: number;
  label: string;
}

export function StarRatingDisplay({ value, label }: StarRatingDisplayProps) {
  return (
    <span aria-label={`${label}: ${value}/5`} style={{ color: 'var(--color-brand)', letterSpacing: 1 }}>
      {'★'.repeat(value)}
      <span style={{ color: 'var(--text-secondary)' }}>{'★'.repeat(5 - value)}</span>
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
    <div>
      <div
        id={id}
        role="radiogroup"
        aria-label={label}
        style={{ display: 'flex', gap: 4, alignItems: 'center' }}
      >
        {[1, 2, 3, 4, 5].map((score) => {
          const active = value !== null && score <= value;
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={value === score}
              aria-label={`${label} ${score} trên 5`}
              disabled={disabled}
              onClick={() => onChange(score)}
              style={{
                background: 'none',
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: 22,
                lineHeight: 1,
                padding: 0,
                color: active ? 'var(--color-brand)' : invalid ? ERROR_COLOR : 'var(--text-secondary)',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              ★
            </button>
          );
        })}
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>
          {value === null ? 'Chưa chọn' : `${value}/5`}
        </span>
      </div>
    </div>
  );
}
