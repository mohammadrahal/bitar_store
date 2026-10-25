'use client'

import { Controller, useForm, type UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { Switch } from '@/components/shared/switch'
import { DevSavedPassword } from '@/components/users/dev-saved-password'
import { useBranches } from '@/hooks/use-branches'
import { useCreateUser, useUpdateUserWithBranch } from '@/hooks/use-users'
import { getUserBranchId } from '@/lib/user-branch-map'
import type { ApiUser } from '@/lib/api'
import { ROLE_LABELS } from '@/lib/permissions'
import {
  createUserSchema,
  emptyCreateUserValues,
  toUpdateUserFormValues,
  updateUserSchema,
  type CreateUserFormValues,
  type UpdateUserFormValues,
} from '@/schemas/user.schema'
import type { Role } from '@/types'

export function UserForm({ user, onClose }: { user?: ApiUser; onClose: () => void }) {
  const isEdit = Boolean(user)
  const create = useCreateUser()
  const update = useUpdateUserWithBranch()
  const { data: branches, isPending: branchesLoading } = useBranches()

  const createForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: emptyCreateUserValues,
  })

  const editForm = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: user ? toUpdateUserFormValues(user, getUserBranchId(user.id)) : undefined,
  })

  const pending = create.isPending || update.isPending
  const role = isEdit ? editForm.watch('role') : createForm.watch('role')

  const submitCreate = createForm.handleSubmit((values) => {
    create.mutate(
      {
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        role: values.role,
        branchId: values.role === 'admin' ? null : values.branchId || null,
      },
      { onSuccess: onClose },
    )
  })

  const submitEdit = editForm.handleSubmit((values) => {
    if (!user) return
    update.mutate(
      {
        id: user.id,
        email: values.email,
        fullName: values.fullName,
        role: values.role,
        isActive: values.isActive,
        password: values.password.trim() || undefined,
        branchId: values.role === 'admin' ? null : values.branchId || null,
      },
      { onSuccess: onClose },
    )
  })

  return (
    <Drawer
      eyebrow="Users"
      title={isEdit ? 'Edit user' : 'New user'}
      description={
        isEdit
          ? 'The server does not allow deleting users — deactivate instead. Password is only changed when you fill it in.'
          : 'Managers and employees must be linked to a branch. They only see that branch after sign-in.'
      }
      onClose={onClose}
      onSubmit={isEdit ? submitEdit : submitCreate}
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
        {isEdit ? (
          <EditFields user={user!} form={editForm} role={role} branches={branches} branchesLoading={branchesLoading} />
        ) : (
          <CreateFields form={createForm} role={role} branches={branches} branchesLoading={branchesLoading} />
        )}
      </div>
    </Drawer>
  )
}

function CreateFields({
  form,
  role,
  branches,
  branchesLoading,
}: {
  form: ReturnType<typeof useForm<CreateUserFormValues>>
  role: Role
  branches: ReturnType<typeof useBranches>['data']
  branchesLoading: boolean
}) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <>
      <Field label="Full name" error={errors.fullName?.message} className="full">
        <input {...register('fullName')} autoComplete="off" placeholder="Sara Khoury" />
      </Field>
      <Field label="Email" error={errors.email?.message} className="full">
        <input {...register('email')} type="email" autoComplete="off" placeholder="sara@bitar.test" />
      </Field>
      <Field label="Password" error={errors.password?.message} hint="At least 8 characters" className="full">
        <input {...register('password')} type="password" autoComplete="new-password" />
      </Field>
      <RoleAndBranchFields register={register} errors={errors} role={role} branches={branches} branchesLoading={branchesLoading} />
    </>
  )
}

function EditFields({
  user,
  form,
  role,
  branches,
  branchesLoading,
}: {
  user: ApiUser
  form: ReturnType<typeof useForm<UpdateUserFormValues>>
  role: Role
  branches: ReturnType<typeof useBranches>['data']
  branchesLoading: boolean
}) {
  const {
    register,
    control,
    formState: { errors },
  } = form

  return (
    <>
      <Field label="Full name" error={errors.fullName?.message} className="full">
        <input {...register('fullName')} autoComplete="off" />
      </Field>
      <Field label="Email" error={errors.email?.message} className="full">
        <input {...register('email')} type="email" autoComplete="off" />
      </Field>
      <Field
        label="New sign-in password"
        error={errors.password?.message}
        hint="Leave blank to keep the saved password below. Type here only to change it."
        className="full"
      >
        <input {...register('password')} type="password" autoComplete="new-password" placeholder="Change password" />
      </Field>
      <div className="full">
        <DevSavedPassword userId={user.id} />
      </div>
      <Field label="Role" error={errors.role?.message} className="full">
        <select {...register('role')}>
          {(Object.keys(ROLE_LABELS) as Role[]).map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>
      {role !== 'admin' && (
        <Field label="Branch" error={errors.branchId?.message} className="full">
          <select {...register('branchId')} disabled={branchesLoading}>
            <option value="">Select a branch</option>
            {branches?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code ?? branch.location})
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="full">
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch
              id="user-is-active"
              checked={field.value}
              onCheckedChange={field.onChange}
              label="Active account"
              description="Inactive users cannot sign in."
            />
          )}
        />
      </div>
    </>
  )
}

function RoleAndBranchFields({
  register,
  errors,
  role,
  branches,
  branchesLoading,
}: {
  register: UseFormRegister<CreateUserFormValues>
  errors: Record<string, { message?: string } | undefined>
  role: Role
  branches: ReturnType<typeof useBranches>['data']
  branchesLoading: boolean
}) {
  return (
    <>
      <Field label="Role" error={errors.role?.message} className="full">
        <select {...register('role')}>
          {(Object.keys(ROLE_LABELS) as Role[]).map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>
      {role !== 'admin' && (
        <Field label="Branch" error={errors.branchId?.message} className="full">
          <select {...register('branchId')} disabled={branchesLoading}>
            <option value="">Select a branch</option>
            {branches?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code ?? branch.location})
              </option>
            ))}
          </select>
        </Field>
      )}
    </>
  )
}
