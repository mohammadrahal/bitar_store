'use client'

import { COUNTRY_DIALS, composePhone, digitsOnly, parsePhone } from '@/lib/phone'

const MAX_NATIONAL_DIGITS = 15

/**
 * Country code on the left, digits only on the right. The value written out is
 * the code plus the number, e.g. `+961 70123456`.
 */
export function PhoneInput({
  id,
  value,
  onChange,
  disabled,
  placeholder = '70123456',
  'aria-invalid': invalid,
  'aria-describedby': describedBy,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}) {
  const { dial, national } = parsePhone(value)

  return (
    <div className="phone-field" data-invalid={invalid ? 'true' : undefined}>
      <select
        className="phone-field-code tabular"
        value={dial}
        disabled={disabled}
        aria-label="Country code"
        onChange={(event) => onChange(composePhone(event.target.value, national))}
      >
        {COUNTRY_DIALS.map((entry) => (
          <option key={entry.dial} value={entry.dial} title={entry.region}>
            {entry.dial}
          </option>
        ))}
      </select>
      <input
        id={id}
        className="tabular"
        value={national}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder}
        maxLength={MAX_NATIONAL_DIGITS}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => {
          const next = event.target.value
          if (next.includes('+') || next.startsWith('00')) {
            const pasted = parsePhone(next)
            onChange(composePhone(pasted.dial, pasted.national.slice(0, MAX_NATIONAL_DIGITS)))
            return
          }
          onChange(composePhone(dial, digitsOnly(next).slice(0, MAX_NATIONAL_DIGITS)))
        }}
      />
    </div>
  )
}
