'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { findDevCredentialByUserId } from '@/lib/dev-credentials'

/**
 * Dev-only: shows the password stored in sessionStorage for mock sign-in.
 * Real login will not expose passwords like this.
 */
export function DevSavedPassword({ userId }: { userId: string }) {
  const [revealed, setRevealed] = useState(false)
  const credential = findDevCredentialByUserId(userId)

  if (!credential) {
    return (
      <p className="field-hint" role="status">
        No sign-in password saved for this tab yet. Enter one below and save — it is used until the API login ships.
      </p>
    )
  }

  return (
    <div className="dev-password-readout" role="status">
      <div className="dev-password-row">
        <span className="dev-password-label">Saved dev sign-in password</span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setRevealed((open) => !open)}
          aria-label={revealed ? 'Hide saved password' : 'Show saved password'}
        >
          {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <code className="dev-password-value">{revealed ? credential.password : '••••••••••••'}</code>
      <p className="field-hint">Only for this tab session, for mock login. The field above is for setting a new password.</p>
    </div>
  )
}
