'use client'

import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Search control used in toolbars, panels and sale flows — one height and focus ring everywhere. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  'aria-label': ariaLabel,
  className,
  id,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  'aria-label': string
  className?: string
  id?: string
  disabled?: boolean
}) {
  return (
    <div className={cn('search-field', className)}>
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </div>
  )
}
