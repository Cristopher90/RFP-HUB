"use client";

// Five stars. Read-only mode fills them by `value` (fractions allowed, e.g. an
// average of 3.6 half-fills the fourth); interactive mode lets the user click
// 1..5 (clicking the current value again clears it).
export function StarRating({
  value,
  onChange,
  size = 16,
  label,
}: {
  value: number;
  onChange?: (stars: number) => void;
  size?: number;
  label?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-0.5 align-middle"
      role={onChange ? "radiogroup" : "img"}
      aria-label={label ?? `${value}/5`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        const star = (
          <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
            <defs>
              <linearGradient id={`star-${n}-${Math.round(fill * 100)}-${size}`}>
                <stop offset={`${fill * 100}%`} stopColor="#f59e0b" />
                <stop offset={`${fill * 100}%`} stopColor="#cbd5e1" />
              </linearGradient>
            </defs>
            <path
              d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7 6.1 20.8l1.2-6.5L2.5 9.7l6.6-.9z"
              fill={`url(#star-${n}-${Math.round(fill * 100)}-${size})`}
              stroke="#f59e0b"
              strokeWidth={0.6}
              strokeLinejoin="round"
            />
          </svg>
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={Math.round(value) === n}
            aria-label={`${n}`}
            onClick={() => onChange(Math.round(value) === n ? 0 : n)}
            className="rounded p-0.5 hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}
