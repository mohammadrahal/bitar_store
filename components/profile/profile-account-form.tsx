'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormAlert } from '@/components/profile/form-alert'
import { Field } from '@/components/shared/field'
import { useUpdateOwnName } from '@/hooks/use-profile'
import { ROLE_LABELS } from '@/lib/permissions'
import { profileSchema, type ProfileValues } from '@/schemas/profile.schema'
import type { User } from '@/types'

export function ProfileAccountForm({ user }: { user: User }) {
  const update = useUpdateOwnName()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user.name },
  })

  /* Reset on success, so the saved name becomes the baseline for isDirty. */
  const submit = handleSubmit((values) =>
    update.mutate(values.fullName, { onSuccess: () => reset(values) }),
  )

  return (
    <form onSubmit={submit} noValidate>
      <div className="panel-body form-grid">
        <FormAlert error={update.error} />
        <Field label="Full name" error={errors.fullName?.message} className="full">
          <input {...register('fullName')} autoComplete="name" />
        </Field>
        <Field label="Email" hint="Your sign-in address. A super admin changes it." className="full">
          <input value={user.email} readOnly disabled />
        </Field>
        <Field label="Role" hint="Roles are granted, never self-assigned." className="full">
          <input value={ROLE_LABELS[user.role]} readOnly disabled />
        </Field>
      </div>
      <div className="panel-actions">
        <button type="submit" className="btn btn-primary" disabled={update.isPending || !isDirty}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
