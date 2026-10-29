'use client'

import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { SelectInput } from '@/components/shared/select-input'
import { LocationAssignmentsField } from '@/components/users/location-assignments-field'
import { useBranches } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'
import { useCreateUser, useUpdateUser, useUserAccess } from '@/hooks/use-users'
import { ROLE_LABELS } from '@/lib/permissions'
import type { StaffUser } from '@/services/users.service'
import { emptyUserValues, toUserFormValues, userFormSchema, type UserFormValues } from '@/schemas/user.schema'
import type { Role } from '@/types'

/** Only a super admin may hand out the owner roles. */
function roleOptions(mayChangeRoles: boolean) {
  const roles: Role[] = mayChangeRoles ? ['super_admin', 'manager', 'employee'] : ['employee']
  return roles.map((value) => ({ value, label: ROLE_LABELS[value] }))
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

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema(!isEdit)),
    values: isEdit && user ? toUserFormValues(user, access?.locations ?? []) : undefined,
    defaultValues: emptyUserValues,
  })

  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form
  const role = watch('role')
  const pending = create.isPending || update.isPending

  const submit = form.handleSubmit((values) => {
    const payload = {
      email: values.email,
      fullName: values.fullName,
      role: values.role,
      password: values.password || undefined,
      locations: values.role === 'employee' ? values.locations : [],
    }
    if (isEdit && user) {
      update.mutate({ id: user.id, ...payload }, { onSuccess: onClose })
      return
    }
    create.mutate(payload, { onSuccess: onClose })
  })

  return (
    <Drawer
      eyebrow="Users"
      title={isEdit ? 'Edit user' : 'New user'}
      description={
        isEdit
          ? 'The password is only changed when you fill it in.'
          : 'An employee works only at the locations you assign. Owners work everywhere.'
      }
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending || branchesLoading}>
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
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
          <p className="full text-sm text-muted-foreground">You cannot change your own role or locations.</p>
        ) : (
          <>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Field
                  label="Role"
                  error={errors.role?.message}
                  hint={mayChangeRoles ? undefined : 'Only a super admin can create managers or super admins.'}
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
            {role === 'employee' && (
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
                  />
                )}
              />
            )}
          </>
        )}
      </div>
    </Drawer>
  )
}
