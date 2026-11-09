'use client'

import { usePermissionCatalog } from '@/hooks/use-user-permissions'
import { toApiRole } from '@/services/session.service'
import { SwitchToggle } from '@/components/shared/switch'
import { isOwnerRole, ROLE_LABELS } from '@/lib/permissions'
import type { Role } from '@/types'

function sourceLabel(allowed: boolean, fromRole: boolean) {
  if (allowed && fromRole) return 'from role'
  if (allowed) return 'added'
  if (fromRole) return 'removed'
  return null
}

/** One checkbox per grantable permission. `users.administer` is omitted (`grantable: false`). */
export function UserPermissionFields({
  role,
  wanted,
  onChange,
  disabled,
}: {
  role: Role
  wanted: Record<string, boolean> | null
  onChange: (key: string, allowed: boolean) => void
  disabled?: boolean
}) {
  /* Both owner roles hold every key, so neither has anything to grant. This
     used to exempt the Admin only, which left a Business Manager being offered
     toggles that `can()` ignored. */
  const owner = isOwnerRole(role)
  const catalog = usePermissionCatalog(!owner)

  if (owner) {
    return (
      <p className="full muted">
        {ROLE_LABELS[role]} already holds every permission. That cannot be changed.
      </p>
    )
  }
  if (catalog.isPending || !wanted) return <p className="full muted">Loading permissions…</p>
  if (catalog.isError) {
    return <p className="full field-error">{catalog.error.message}</p>
  }

  const defaults = new Set(catalog.data.roles[toApiRole(role)] ?? [])
  const rows = catalog.data.permissions.filter((permission) => permission.grantable)

  return (
    <section className="full switch-stack">
      <h3 className="eyebrow">Permissions</h3>
      <p className="field-hint">
        The role starts the list. A change applies on their next request. Manage users cannot be granted.
      </p>
      {rows.map((permission) => {
        const allowed = Boolean(wanted[permission.key])
        const badge = sourceLabel(allowed, defaults.has(permission.key))
        const id = `permission-${permission.key}`
        return (
          <div key={permission.key} className="switch-field">
            <div className="switch-copy">
              <label htmlFor={id}>
                {permission.label}
                {badge ? <span className="pill pill-neutral">{badge}</span> : null}
              </label>
              <p>{permission.description}</p>
            </div>
            <SwitchToggle
              id={id}
              checked={allowed}
              disabled={disabled}
              label={permission.label}
              onCheckedChange={(on) => onChange(permission.key, on)}
            />
          </div>
        )
      })}
    </section>
  )
}
