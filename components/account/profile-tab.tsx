'use client'

import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { FadeIn } from '@/components/motion/fade-in'
import { SettingsCard, SettingsRow } from '@/components/account/settings-row'
import { StickySaveBar } from '@/components/account/sticky-save-bar'
import { useBranches } from '@/hooks/use-branches'
import { useUpdateOwnName } from '@/hooks/use-profile'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { usePermission } from '@/hooks/use-permission'
import { initials } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/permissions'
import { profileSchema } from '@/schemas/profile.schema'

export function ProfileTab() {
  const { user, locationScoped, activeLocationId } = usePermission()
  const { data: branches } = useBranches()
  const update = useUpdateOwnName()
  const [fullName, setFullName] = useState(user.name)
  const dirty = fullName.trim() !== user.name.trim()
  const parsed = profileSchema.safeParse({ fullName })
  const canSave = dirty && parsed.success

  useEffect(() => {
    setFullName(user.name)
  }, [user.name])

  useUnsavedChangesGuard(dirty)

  const discard = () => setFullName(user.name)
  const save = () => {
    if (!canSave) return
    update.mutate(parsed.data!.fullName, { onError: () => {} })
  }

  return (
    <FadeIn className="settings-page">
      <SettingsCard>
        <div className="account-profile-head">
          <span className="account-avatar" aria-hidden="true">
            {initials(user.name)}
          </span>
          <div className="account-profile-head-text">
            <strong>{user.name}</strong>
            <span className={`pill pill-neutral account-role-pill`}>
              <span className="pill-dot" aria-hidden="true" />
              {ROLE_LABELS[user.role]}
            </span>
            <span className="account-profile-email">{user.email}</span>
          </div>
        </div>

        <SettingsRow label="Full name" description="Shown on receipts and audit entries you create.">
          <input
            className="settings-input"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            aria-invalid={dirty && !parsed.success}
          />
          {dirty && !parsed.success && (
            <p className="field-error">{parsed.error.issues[0]?.message ?? 'Invalid name'}</p>
          )}
          {update.isError && update.error instanceof Error && (
            <p className="field-error" role="alert">
              {update.error.message}
            </p>
          )}
        </SettingsRow>

        <SettingsRow label="Email" description="An admin or business manager changes this.">
          <div className="settings-readonly">
            <Lock size={14} aria-hidden="true" />
            <span>{user.email}</span>
          </div>
        </SettingsRow>

        <SettingsRow label="Role" description="Your permissions across the app.">
          <span className={`pill pill-neutral account-role-pill`}>
            <span className="pill-dot" aria-hidden="true" />
            {ROLE_LABELS[user.role]}
          </span>
        </SettingsRow>

        <SettingsRow
          label="Locations"
          description={
            locationScoped ? 'Where you may work. View-only locations are read-only on the till.' : undefined
          }
        >
          {locationScoped ? (
            <div className="account-location-chips">
              {user.locations.length === 0 ? (
                <p className="muted">No location assigned yet.</p>
              ) : (
                user.locations.map((assignment) => {
                  const branch = branches?.find((candidate) => candidate.id === assignment.locationId)
                  const isActive = activeLocationId === assignment.locationId
                  return (
                    <span
                      key={assignment.locationId}
                      className={`account-location-chip ${isActive ? 'is-active' : ''}`}
                    >
                      {branch?.name ?? 'Location'}
                      {assignment.access === 'view_only' && <small>View only</small>}
                      {isActive && user.locations.length > 1 && <small>Active</small>}
                    </span>
                  )
                })
              )}
            </div>
          ) : (
            <p className="settings-static">All locations, including the warehouse.</p>
          )}
        </SettingsRow>
      </SettingsCard>

      <StickySaveBar
        visible={dirty}
        saving={update.isPending}
        saveDisabled={!canSave}
        onDiscard={discard}
        onSave={save}
      />
    </FadeIn>
  )
}
