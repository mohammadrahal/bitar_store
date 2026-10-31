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
  placeholder = 'Select',
  ...aria
}: {
  value: string
  onChange: (value: string) => void
  exclude?: string
  onlyAccessible?: boolean
  /** Leaves out view-only assignments, which may be looked at but not acted on. */
  onlyFullAccess?: boolean
  placeholder?: string
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}) {
  const { data: branches, isPending } = useBranches()
  const { data: warehouseId } = useWarehouseId()
  const { canAccessLocation, locationAccess } = usePermission()

  const options = (branches ?? [])
    .filter((branch) => branch.id !== exclude && branch.isActive)
    .filter((branch) => !onlyAccessible || canAccessLocation(branch.id))
    .filter((branch) => !onlyFullAccess || locationAccess(branch.id) === 'full')
    .map((branch) => ({
      value: branch.id,
      label: branch.id === warehouseId ? `${branch.name} (warehouse)` : branch.name,
    }))

  return (
    <SelectInput
      value={value}
      onValueChange={onChange}
      options={options}
      placeholder={placeholder}
      disabled={isPending || options.length === 0}
      {...aria}
    />
  )
}
