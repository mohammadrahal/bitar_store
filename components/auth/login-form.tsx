'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { Field } from '@/components/shared/field'
import { useLogin } from '@/hooks/use-auth'
import { emptyLoginValues, loginSchema, type LoginFormValues } from '@/schemas/auth.schema'

export function LoginForm() {
  const [revealed, setRevealed] = useState(false)
  const signIn = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: emptyLoginValues,
  })

  const submit = handleSubmit((values) => signIn.mutate(values))

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {signIn.isError && (
        <p className="auth-alert" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {signIn.error.message}
        </p>
      )}

      <Field label="Email" error={errors.email?.message}>
        <input {...register('email')} type="email" autoComplete="email" placeholder="you@bitar.store" autoFocus />
      </Field>

      <Field
        label="Password"
        error={errors.password?.message}
        affix={
          <button
            type="button"
            className="icon-btn"
            onClick={() => setRevealed((shown) => !shown)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            title={revealed ? 'Hide password' : 'Show password'}
          >
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
      >
        <input
          {...register('password')}
          type={revealed ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </Field>

      <button type="submit" className="btn btn-primary btn-block" disabled={signIn.isPending}>
        {signIn.isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
