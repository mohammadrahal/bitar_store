'use client'

import { ProfileAccountForm } from '@/components/profile/profile-account-form'
import { ProfileLocations } from '@/components/profile/profile-locations'
import { ProfilePasswordForm } from '@/components/profile/profile-password-form'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { usePermission } from '@/hooks/use-permission'
import { ROLE_LABELS } from '@/lib/permissions'

export function ProfileView() {
  const { user, locationScoped } = usePermission()

  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title={user.name}
        description={`${user.email} · ${ROLE_LABELS[user.role]}`}
      />

      <Panel title="Account" description="What other people see on the records you create.">
        <ProfileAccountForm user={user} />
      </Panel>

      <Panel
        title="Locations"
        description={
          locationScoped
            ? 'Only a super admin can change where you work.'
            : 'Your role reaches every location, so nothing is assigned one by one.'
        }
      >
        {locationScoped ? (
          <ProfileLocations user={user} />
        ) : (
          <div className="panel-body">
            <p className="muted">Every location, including the warehouse.</p>
          </div>
        )}
      </Panel>

      <Panel title="Security" description="Sets the password you sign in with, on every device.">
        <ProfilePasswordForm />
      </Panel>
    </>
  )
}
