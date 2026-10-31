'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { FormAlert } from '@/components/profile/form-alert'
import { Field } from '@/components/shared/field'
import { useChangeOwnPassword } from '@/hooks/use-profile'
import {
  emptyPasswordChange,
  passwordChangeSchema,
  type PasswordChangeValues,
} from '@/schemas/profile.schema'

export function ProfilePasswordForm() {
  const change = useChangeOwnPassword()
  const [revealed, setRevealed] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: emptyPasswordChange,
  })

  const submit = handleSubmit((values) =>
    change.mutate(values.password, { onSuccess: () => reset(emptyPasswordChange) }),
  )

  return (
    <form onSubmit={submit} noValidate>
      <div className="panel-body form-grid">
        <FormAlert error={change.error} />
        <Field
          label="New password"
          error={errors.password?.message}
          hint="At least 8 characters."
          className="full"
          affix={
            <button
              type="button"
              className="icon-btn"
              onClick={() => setRevealed((shown) => !shown)}
              aria-label={revealed ? 'Hide password' : 'Show password'}
            >
              {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        >
          <input {...register('password')} type={revealed ? 'text' : 'password'} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" error={errors.confirm?.message} className="full">
          <input {...register('confirm')} type={revealed ? 'text' : 'password'} autoComplete="new-password" />
        </Field>
      </div>
      <div className="panel-actions">
        <button type="submit" className="btn btn-primary" disabled={change.isPending}>
          {change.isPending ? 'Saving…' : 'Update password'}
        </button>
      </div>
    </form>
  )
}
