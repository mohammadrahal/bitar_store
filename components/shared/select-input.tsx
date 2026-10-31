'use client'

import type { VariantProps } from 'class-variance-authority'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  selectTriggerVariants,
} from '@/components/ui/select'

export type SelectOption = { value: string; label: string; disabled?: boolean }

type SelectInputProps = VariantProps<typeof selectTriggerVariants> & {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Decorative icon inside the trigger, before the value. */
  icon?: React.ReactNode
  id?: string
  title?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/**
 * One-shot dropdown for an options array. Keeps the shadcn parts in
 * components/ui/select.tsx and takes the id/aria props that <Field> clones in,
 * forwarding them to the trigger where screen readers expect them.
 */
export function SelectInput({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  icon,
  id,
  title,
  variant,
  size,
  ...aria
}: SelectInputProps) {
  const selectedValue = value && options.some((option) => option.value === value) ? value : null

  return (
    /* `items` resolves labels; if the value is not in `options` yet, keep the
       control empty so the trigger never shows a raw id. */
    <Select<string>
      items={options}
      value={selectedValue}
      onValueChange={(next) => onValueChange(next ?? '')}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        title={title}
        variant={variant}
        size={size}
        className={className}
        {...aria}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <SelectValue placeholder={placeholder} />
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
