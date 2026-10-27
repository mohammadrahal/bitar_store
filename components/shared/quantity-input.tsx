'use client'

/**
 * Whole-unit input that cannot go above `max`. Typing more snaps back to the
 * cap and says why, so a quantity above what is available is never submitted.
 */
export function QuantityInput({
  value,
  max,
  onChange,
  label,
  capLabel = 'available',
  min = 0,
}: {
  value: number
  max: number
  onChange: (value: number) => void
  /** Accessible name, e.g. "Quantity for Black / S". */
  label: string
  capLabel?: string
  min?: number
}) {
  const atCap = value >= max
  return (
    <span className="qty-row">
      <input
        className="qty-input tabular"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={Number.isFinite(value) ? value : ''}
        aria-label={label}
        onChange={(event) => {
          const parsed = Math.floor(Number(event.target.value))
          onChange(Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min)
        }}
      />
      <small className={`qty-hint tabular ${atCap ? 'at-cap' : ''}`}>
        {atCap && max > 0 ? `Only ${max} ${capLabel}` : `${max} ${capLabel}`}
      </small>
    </span>
  )
}
