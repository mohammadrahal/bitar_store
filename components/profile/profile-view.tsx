'use client'

import Link from 'next/link'
import { ProfileAccountForm } from '@/components/profile/profile-account-form'
import { ProfileLocations } from '@/components/profile/profile-locations'
import { ProfilePasswordForm } from '@/components/profile/profile-password-form'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { usePermission } from '@/hooks/use-permission'
import { adminHubHref } from '@/lib/admin-hub'
import { ROLE_LABELS } from '@/lib/permissions'

export function ProfileView() {
  const { user, locationScoped, can } = usePermission()

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
            ? 'Only an admin or business manager can change where you work.'
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

      {can('settings.manage') && (
        <Panel title="Store settings" description="Rates and options that every branch uses on the till.">
          <div className="panel-body">
            <Link href={adminHubHref('settings')} className="btn btn-secondary">
              USD / LBP exchange rate
            </Link>
          </div>
        </Panel>
      )}
    </>
  )
}
