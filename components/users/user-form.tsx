'use client'

import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { FilterChips } from '@/components/shared/filter-chips'
import { SelectInput } from '@/components/shared/select-input'
import { LocationAssignmentsField } from '@/components/users/location-assignments-field'
import { UserPermissionFields } from '@/components/users/user-permission-fields'
import { isApiFeatureMissing } from '@/lib/api/capabilities'
import { useBranches } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'
import { useBranchAccess, useCreateUser, useUpdateUser, useUserAccess } from '@/hooks/use-users'
import { usePermissionDraft } from '@/hooks/use-user-permissions'
import { isOwnerRole, ROLE_LABELS } from '@/lib/permissions'
import type { StaffUser } from '@/services/users.service'
import { emptyUserValues, toUserFormValues, userFormSchema, type UserFormValues } from '@/schemas/user.schema'
import type { LocationAssignment, Role } from '@/types'

/** Only a holder of `users.role.change` may hand out the owner roles. */
function roleOptions(mayChangeRoles: boolean) {
  const roles: Role[] = mayChangeRoles ? ['super_admin', 'manager', 'employee'] : ['employee']
  return roles.map((value) => ({ value, label: ROLE_LABELS[value] }))
}

function managerLocations(branchIds: string[]): LocationAssignment[] {
  return branchIds.map((locationId) => ({ locationId, access: 'full' }))
}

export function UserForm({ user, onClose }: { user?: StaffUser; onClose: () => void }) {
  const isEdit = Boolean(user)
  const { user: currentUser, can } = usePermission()
  const mayChangeRoles = can('users.role.change')
  const isSelf = currentUser.id === user?.id
  const create = useCreateUser()
  const update = useUpdateUser()
  const { data: branches, isPending: branchesLoading } = useBranches()
  const { data: access } = useUserAccess(user?.id ?? '')
  const remoteAccess = useBranchAccess(isEdit && user?.role === 'manager' ? user.id : '')
  const accessReady =
    !isEdit ||
    user?.role !== 'manager' ||
    isApiFeatureMissing('branchAccess') ||
    remoteAccess.isFetched
  const managerMode = remoteAccess.data?.mode ?? user?.branchAccessMode ?? 'selected'
  const managerLocationsForForm = remoteAccess.data
    ? managerMode === 'selected'
      ? managerLocations(remoteAccess.data.branchIds)
      : []
    : (access?.locations ?? [])

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema(!isEdit)),
    values:
      isEdit && user && accessReady
        ? toUserFormValues(
            user,
            user.role === 'manager' ? managerLocationsForForm : (access?.locations ?? []),
            user.role === 'manager' ? managerMode : 'selected',
          )
        : undefined,
    defaultValues: emptyUserValues,
  })

  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form
  const role = watch('role')
  const draft = usePermissionDraft(role, user?.id)
  const pending = create.isPending || update.isPending
  /* Neither owner role has grantable permissions: both hold every key. */
  const permissionsApply = !isSelf && !isOwnerRole(role)
  const waitingOnPermissions = permissionsApply && !draft.ready && !draft.catalog.isError

  const submit = form.handleSubmit((values) => {
    const payload = {
      email: values.email,
      fullName: values.fullName,
      role: values.role,
      password: values.password || undefined,
      locations:
        values.role === 'manager' && values.branchAccess === 'all'
          ? []
          : values.role === 'super_admin'
            ? []
            : values.locations,
      branchAccess: values.role === 'manager' ? values.branchAccess : 'selected',
      previousRole: user?.role,
      permissionChanges: permissionsApply && draft.wanted ? draft.changes() : undefined,
    }
    if (isEdit && user) {
      update.mutate({ id: user.id, ...payload }, { onSuccess: onClose })
      return
    }
    create.mutate(payload, { onSuccess: onClose })
  })

  return (
    <Drawer
      eyebrow="Employees"
      title={isEdit ? 'Edit employee' : 'New employee'}
      description={
        isEdit
          ? 'The password is only changed when you fill it in.'
          : 'Set a password now. They cannot sign in until it is saved.'
      }
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending || branchesLoading || !accessReady || waitingOnPermissions}>
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create employee'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Full name" error={errors.fullName?.message} className="full">
          <input {...register('fullName')} autoComplete="off" placeholder="Sara Khoury" />
        </Field>
        <Field label="Email" error={errors.email?.message} className="full">
          <input {...register('email')} type="email" autoComplete="off" placeholder="sara@bitar.test" />
        </Field>
        <Field
          label={isEdit ? 'New sign-in password' : 'Password'}
          error={errors.password?.message}
          hint={isEdit ? 'Leave blank to keep the current password. At least 8 characters.' : 'At least 8 characters'}
          className="full"
        >
          <input {...register('password')} type="password" autoComplete="new-password" />
        </Field>

        {isSelf ? (
          <p className="full text-sm text-muted-foreground">You cannot change your own role, branches, or permissions.</p>
        ) : (
          <>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Field
                  label="Role"
                  error={errors.role?.message}
                  hint={mayChangeRoles ? undefined : 'Only an admin can create managers or admins.'}
                  className="full"
                >
                  <SelectInput
                    value={field.value}
                    onValueChange={field.onChange}
                    options={roleOptions(mayChangeRoles)}
                    disabled={!mayChangeRoles}
                  />
                </Field>
              )}
            />

            {/* Setting another manager's branch reach is a `users.manage` job,
                which both owner roles hold. It was gated on the Admin role
                while that role outranked the managers. */}
            {can('users.manage') && role === 'manager' && !isApiFeatureMissing('branchAccess') && (
              <Controller
                control={control}
                name="branchAccess"
                render={({ field }) => (
                  <div className="field full">
                    <p className="eyebrow">Branch access</p>
                    <FilterChips
                      label="Branch access"
                      options={[
                        { value: 'all', label: 'All branches' },
                        { value: 'selected', label: 'Selected branches' },
                      ]}
                      value={field.value}
                      onChange={field.onChange}
                    />
                    <p className="field-hint">
                      All branches covers every shop, including ones opened later. It does not include the warehouse.
                      Choose selected branches and tick the warehouse if this manager should send stock.
                    </p>
                  </div>
                )}
              />
            )}

            {(role === 'employee' || (role === 'manager' && watch('branchAccess') === 'selected')) && (
              <Controller
                control={control}
                name="locations"
                render={({ field }) => (
                  <LocationAssignmentsField
                    branches={branches}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={branchesLoading}
                    error={errors.locations?.message}
                    showAccess={role === 'employee'}
                  />
                )}
              />
            )}

            {permissionsApply && !isApiFeatureMissing('permissions') && (
              <UserPermissionFields
                role={role}
                wanted={draft.wanted}
                disabled={pending}
                onChange={(key, allowed) => draft.setWanted((current) => ({ ...(current ?? {}), [key]: allowed }))}
              />
            )}
          </>
        )}
      </div>
    </Drawer>
  )
}
