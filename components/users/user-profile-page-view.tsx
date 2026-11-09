'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { UserForm } from '@/components/users/user-form'
import { UserProfileDossier } from '@/components/users/user-profile-dossier'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Skeleton } from '@/components/shared/skeleton'
import { usePermission } from '@/hooks/use-permission'
import { useUsers } from '@/hooks/use-users'
import { useCurrentUser } from '@/store/user-store'
import type { StaffUser } from '@/services/users.service'

export function UserProfilePageView({ userId }: { userId: string }) {
  const session = useCurrentUser()
  const { can, user: sessionUser } = usePermission()
  const { data: users, isPending, isError, error, refetch } = useUsers(can('users.manage') || userId === session.id)
  const [editing, setEditing] = useState<StaffUser | null>(null)

  const subject = useMemo(() => users?.find((row) => row.id === userId), [users, userId])
  const isSelf = userId === session.id
  const allowed = isSelf || can('users.manage')

  if (!allowed) {
    return (
      <ErrorState
        title="No access"
        error={new Error('You do not have permission to view this profile.')}
      />
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title={isSelf ? 'Your identity dossier' : 'Employee profile'}
        description={
          isSelf
            ? 'Executive or floor identity, permissions, and credentials.'
            : 'Cryptographic governance view for a staff account.'
        }
        actions={
          <Link href={isSelf ? '/account' : '/users'} className="btn btn-secondary">
            <ArrowLeft size={16} aria-hidden="true" />
            {isSelf ? 'Account settings' : 'Back to employees'}
          </Link>
        }
      />

      {isPending ? (
        <Skeleton rows={3} stats={4} />
      ) : isError ? (
        <ErrorState title="Could not load employees" error={error} onRetry={() => void refetch()} />
      ) : !subject ? (
        <ErrorState title="Employee not found" error={new Error('No account with this id.')} />
      ) : (
        <UserProfileDossier
          subject={subject}
          context={isSelf ? 'self' : 'admin'}
          sessionUser={sessionUser}
          onEdit={can('users.manage') ? () => setEditing(subject) : undefined}
        />
      )}

      {editing ? <UserForm user={editing} onClose={() => setEditing(null)} /> : null}
    </>
  )
}
