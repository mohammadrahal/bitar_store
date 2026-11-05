'use client'

import Link from 'next/link'
import { SelectInput } from '@/components/shared/select-input'
import { useCategoryRecords } from '@/hooks/use-categories'
import { usePermission } from '@/hooks/use-permission'

/**
 * A product can only use a category that already exists.
 * New names are added on the Categories page, not typed here.
 */
export function CategoryPicker({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (category: string) => void
  error?: string
}) {
  const { can } = usePermission()
  const { data: categories, isPending, isError } = useCategoryRecords(true)
  const known = categories ?? []
  const options = known.map((category) => ({ value: category.name, label: category.name }))
  if (value && !options.some((option) => option.value === value)) {
    options.push({ value, label: `${value} (inactive)` })
  }

  return (
    <>
      <SelectInput
        value={value}
        onValueChange={onChange}
        options={options}
        placeholder={isPending ? 'Loading categories…' : 'Choose a category'}
        disabled={isPending || isError}
        aria-invalid={error ? true : undefined}
      />
      {error ? <p className="field-error">{error}</p> : null}
      {isError ? <p className="field-error">Could not load categories.</p> : null}
      {!isPending && !isError && known.length === 0 ? (
        <p className="field-hint">No active categories yet. Add one before saving a product.</p>
      ) : (
        <p className="field-hint">Only categories that already exist can be used.</p>
      )}
      {can('catalog.create') && (
        <p className="field-hint">
          <Link href="/categories">Manage categories</Link>
        </p>
      )}
    </>
  )
}
