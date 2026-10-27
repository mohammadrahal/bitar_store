'use client'

export interface ChipOption<T extends string> {
  value: T
  label: string
  count?: number
}

/** A single-choice row of toggle chips, for filters with only a few options. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ChipOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="chip-row" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="chip"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span className="chip-count tabular">{option.count}</span>}
        </button>
      ))}
    </div>
  )
}
