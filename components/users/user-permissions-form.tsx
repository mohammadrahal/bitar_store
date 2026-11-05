'use client'

import { Drawer } from '@/components/shared/drawer'
import { UserPermissionFields } from '@/components/users/user-permission-fields'
import { usePermissionDraft, useSetUserPermissions } from '@/hooks/use-user-permissions'
import type { StaffUser } from '@/services/users.service'

/** Extra permissions on top of the role, saved with `PUT /users/:id/permissions`. */
export function UserPermissionsForm({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const draft = usePermissionDraft(user.role, user.id)
  const save = useSetUserPermissions()
  const blocked = user.role === 'super_admin'

  const submit = () => {
    if (blocked) {
      onClose()
      return
    }
    const permissions = draft.changes()
    if (Object.keys(permissions).length === 0) {
      onClose()
      return
    }
    save.mutate({ id: user.id, name: user.fullName, permissions }, { onSuccess: onClose })
  }

  return (
    <Drawer
      eyebrow="Permissions"
      title={user.fullName}
      description="What this person can do beyond their role. The server is the real check."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending || (!blocked && !draft.ready)}>
            {save.isPending ? 'Saving…' : 'Save permissions'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <UserPermissionFields
          role={user.role}
          wanted={draft.wanted}
          disabled={save.isPending || blocked}
          onChange={(key, allowed) => draft.setWanted((current) => ({ ...(current ?? {}), [key]: allowed }))}
        />
      </div>
    </Drawer>
  )
}
