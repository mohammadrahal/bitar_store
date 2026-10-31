'use client'

import { useState } from 'react'
import { Drawer } from '@/components/shared/drawer'
import { SelectInput } from '@/components/shared/select-input'
import { Switch } from '@/components/shared/switch'
import { useBranches } from '@/hooks/use-branches'
import { useSaveUserGrants, useUserAccess } from '@/hooks/use-users'
import {
  PERMISSION_GROUPS,
  PERMISSION_HINTS,
  PERMISSION_LABELS,
  PLATFORM_SCOPE,
  type EmployeePermission,
} from '@/lib/permission-keys'
import type { StaffUser } from '@/services/users.service'

/**
 * Pick an employee, pick a location, toggle keys. Catalog is one shared list
 * across the business, so its keys appear once rather than per location.
 */
export function UserPermissionsForm({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const { data: access, isPending } = useUserAccess(user.id)
  const { data: branches } = useBranches()
  const save = useSaveUserGrants()
  const [draft, setDraft] = useState<Record<string, string[]> | null>(null)
  const [scope, setScope] = useState<string>('')

  const grants = draft ?? access?.grants ?? {}
  const assigned = access?.locations ?? []
  const activeScope = scope || assigned[0]?.locationId || ''
  const nameOf = (locationId: string) => branches?.find((branch) => branch.id === locationId)?.name ?? 'Location'

  const keysAt = (key: string) => grants[key] ?? []

  const toggle = (bucket: string, permission: EmployeePermission, on: boolean) => {
    const current = keysAt(bucket)
    const next = on ? [...new Set([...current, permission])] : current.filter((entry) => entry !== permission)
    setDraft({ ...grants, [bucket]: next })
  }

  return (
    <Drawer
      eyebrow="Permissions"
      title={user.fullName}
      description="Granted per location, except the catalog, which is granted once. The backend remains the real check."
      onClose={onClose}
      onSubmit={() =>
        save.mutate({ userId: user.id, name: user.fullName, grants }, { onSuccess: onClose })
      }
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending || isPending}>
            {save.isPending ? 'Saving…' : 'Save permissions'}
          </button>
        </>
      }
    >
      {assigned.length === 0 ? (
        <p className="muted">Assign a location to this employee first; keys are granted per location.</p>
      ) : (
        <div className="form-grid">
          {assigned.length > 1 && (
            <div className="field full">
              <label htmlFor="permission-scope">Location</label>
              <SelectInput
                value={activeScope}
                onValueChange={setScope}
                options={assigned.map((entry) => ({
                  value: entry.locationId,
                  label: `${nameOf(entry.locationId)}${entry.access === 'view_only' ? ' — view only' : ''}`,
                }))}
              />
            </div>
          )}

          {PERMISSION_GROUPS.map((group) => {
            const bucket = group.platformWide ? PLATFORM_SCOPE : activeScope
            return (
              <section key={group.label} className="full switch-stack">
                <h3 className="eyebrow">
                  {group.label}
                  {group.platformWide ? ' — all locations' : ` — ${nameOf(activeScope)}`}
                </h3>
                {group.keys.map((permission) => (
                  <Switch
                    key={permission}
                    id={`${bucket}-${permission}`}
                    checked={keysAt(bucket).includes(permission)}
                    onCheckedChange={(on) => toggle(bucket, permission, on)}
                    label={PERMISSION_LABELS[permission]}
                    description={PERMISSION_HINTS[permission]}
                  />
                ))}
              </section>
            )
          })}
        </div>
      )}
    </Drawer>
  )
}
