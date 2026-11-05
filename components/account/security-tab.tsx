'use client'

import { useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { FadeIn } from '@/components/motion/fade-in'
import { SettingsCard, SettingsRow } from '@/components/account/settings-row'
import { useChangeOwnPassword } from '@/hooks/use-profile'

function PasswordInput({
  label,
  value,
  onChange,
  error,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  autoComplete: string
}) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="settings-password-field">
      <label className="sr-only" htmlFor={`${label}-input`}>
        {label}
      </label>
      <div className="settings-input-affix">
        <input
          id={`${label}-input`}
          className="settings-input"
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
        />
        <button
          type="button"
          className="icon-btn settings-input-toggle"
          onClick={() => setRevealed((shown) => !shown)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
        >
          {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

function CheckItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`password-check ${ok ? 'is-ok' : ''}`}>
      <span className="password-check-mark" aria-hidden="true" />
      {children}
    </li>
  )
}

export function SecurityTab() {
  const change = useChangeOwnPassword()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const checks = useMemo(
    () => ({
      length: password.length >= 8,
      notSame: password.length > 0 && current.length > 0 && password !== current,
      confirm: password.length > 0 && password === confirm,
    }),
    [current, password, confirm],
  )

  const allPass = checks.length && checks.notSame && checks.confirm && current.trim().length > 0
  const currentError =
    change.isError && change.error instanceof Error ? change.error.message : undefined

  const submit = () => {
    if (!allPass) return
    change.mutate(
      { password, currentPassword: current },
      {
        onSuccess: () => {
          setCurrent('')
          setPassword('')
          setConfirm('')
        },
      },
    )
  }

  return (
    <FadeIn className="settings-page">
      <SettingsCard>
        <SettingsRow label="Current password" description="Required before setting a new one.">
          <PasswordInput
            label="Current password"
            value={current}
            onChange={setCurrent}
            error={currentError}
            autoComplete="current-password"
          />
        </SettingsRow>
        <SettingsRow label="New password" description="At least 8 characters, different from your current password.">
          <div className="stack gap-sm">
            <PasswordInput label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
            <ul className="password-checklist" aria-live="polite">
              <CheckItem ok={checks.length}>At least 8 characters</CheckItem>
              <CheckItem ok={checks.notSame}>Not the same as your current password</CheckItem>
              <CheckItem ok={checks.confirm}>Confirmation matches</CheckItem>
            </ul>
          </div>
        </SettingsRow>
        <SettingsRow label="Confirm new password">
          <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </SettingsRow>
        <div className="settings-row settings-row-action">
          <div className="settings-row-label" />
          <div className="settings-row-field">
            <button type="button" className="btn btn-primary" disabled={!allPass || change.isPending} onClick={submit}>
              {change.isPending ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </div>
      </SettingsCard>
    </FadeIn>
  )
}
