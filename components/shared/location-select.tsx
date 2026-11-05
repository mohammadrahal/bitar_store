'use client'

import { SelectInput } from '@/components/shared/select-input'
import { useBranches } from '@/hooks/use-branches'
import { useWarehouseId } from '@/hooks/use-inventory'
import { usePermission } from '@/hooks/use-permission'

/** Branch picker that names the warehouse and only offers locations the user may act for. */
export function LocationSelect({
  value,
  onChange,
  exclude,
  onlyAccessible = false,
  onlyFullAccess = false,
  /** Prepends an empty value meaning every accessible location (admin history). */
  allowAll = false,
  allLabel = 'All locations',
  placeholder = 'Select',
  variant,
  size,
  className,
  ...aria
}: {
  value: string
  onChange: (value: string) => void
  exclude?: string
  onlyAccessible?: boolean
  /** Leaves out view-only assignments, which may be looked at but not acted on. */
  onlyFullAccess?: boolean
  allowAll?: boolean
  allLabel?: string
  placeholder?: string
  variant?: 'field' | 'inline'
  size?: 'default' | 'sm'
  className?: string
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}) {
  const { data: branches, isPending } = useBranches()
  const { data: warehouseId } = useWarehouseId()
  const { canAccessLocation, locationAccess } = usePermission()

  const branchOptions = (branches ?? [])
    .filter((branch) => branch.id !== exclude && branch.isActive)
    .filter((branch) => !onlyAccessible || canAccessLocation(branch.id))
    .filter((branch) => !onlyFullAccess || locationAccess(branch.id) === 'full')
    .map((branch) => ({
      value: branch.id,
      label: branch.id === warehouseId ? `${branch.name} (warehouse)` : branch.name,
    }))
  const options = allowAll ? [{ value: '', label: allLabel }, ...branchOptions] : branchOptions

  return (
    <SelectInput
      value={value}
      onValueChange={onChange}
      options={options}
      placeholder={placeholder}
      disabled={isPending || options.length === 0}
      variant={variant}
      size={size}
      className={className}
      {...aria}
    />
  )
}
