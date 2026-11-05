'use client'

import { RANGE_PRESETS, rangeLabel, type RangeDays } from '@/lib/dashboard-range'

/**
 * Scopes every figure below it, so it sits in its own row above the panels
 * rather than inside any one of them. Presets only: nobody reaches for a
 * calendar grid to say "last 30 days", and the Reports screen already carries
 * the custom range for the cases that need an exact window.
 */
export function RangeFilter({ value, onChange }: { value: RangeDays; onChange: (days: RangeDays) => void }) {
  return (
    <div className="segmented compact" role="radiogroup" aria-label="Date range">
      {RANGE_PRESETS.map((days) => (
        <button
          key={days}
          type="button"
          role="radio"
          aria-checked={value === days}
          className={value === days ? 'active' : ''}
          onClick={() => onChange(days)}
        >
          {rangeLabel(days)}
        </button>
      ))}
    </div>
  )
}
