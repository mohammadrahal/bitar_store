'use client'

import { useState, type InputHTMLAttributes, type Ref } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  /** `undefined` or `NaN` shows an empty box; zero does too, so typing never lands after a leading 0. */
  value: number | undefined
  onChange: (value: number | undefined) => void
  ref?: Ref<HTMLInputElement>
  /** Whole numbers only, for unit counts. */
  integer?: boolean
}

const toText = (value: number | undefined) => (value === undefined || !Number.isFinite(value) || value === 0 ? '' : String(value))

const parse = (text: string) => (text === '' || text === '.' ? undefined : Number(text))

function clean(raw: string, integer: boolean) {
  const text = raw.replace(',', '.').replace(integer ? /[^\d]/g : /[^\d.]/g, '')
  const dot = text.indexOf('.')
  if (dot === -1) return text
  return text.slice(0, dot + 1) + text.slice(dot + 1).replace(/\./g, '').slice(0, 2)
}

/**
 * A text box for amounts. Keeps what was typed (`12.`, a cleared box) instead of
 * round-tripping through a number on every key, which made `type="number"`
 * inputs jump back or gain a leading zero.
 */
export function MoneyInput({ value, onChange, integer = false, placeholder = '0', className, ref, ...rest }: Props) {
  const [text, setText] = useState(() => toText(value))
  const [seen, setSeen] = useState(value)

  if (!Object.is(value, seen)) {
    setSeen(value)
    if (!Object.is(parse(text), value) && !(value === 0 && text === '')) setText(toText(value))
  }

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      className={`tabular ${className ?? ''}`}
      placeholder={placeholder}
      value={text}
      onChange={(event) => {
        const next = clean(event.target.value, integer)
        const parsed = parse(next)
        setText(next)
        setSeen(parsed)
        onChange(parsed)
      }}
    />
  )
}
