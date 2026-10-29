'use client'

import { MapPin } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { useBranches } from '@/hooks/use-branches'
import { useNeedsActiveLocation } from '@/hooks/use-active-location'
import { usePermission } from '@/hooks/use-permission'
import { useUIStore } from '@/store/ui-store'

/**
 * An employee assigned to more than one location has to say where they are
 * before anything is recorded: a sale, a count or a request all belong to one
 * location, and guessing would put stock out of sight.
 */
export function ActiveLocationGate({ children }: { children: React.ReactNode }) {
  const needsChoice = useNeedsActiveLocation()
  const { user } = usePermission()
  const { data: branches } = useBranches()
  const setActiveLocationId = useUIStore((state) => state.setActiveLocationId)

  if (!needsChoice) return <>{children}</>

  return (
    <EmptyState
      icon={MapPin}
      title="Where are you working today?"
      description="You are assigned to more than one location. Pick the one you are at — every sale and movement is recorded against it. You can switch from the header later."
      action={
        <div className="row-actions">
          {user.locations.map((entry) => {
            const branch = branches?.find((candidate) => candidate.id === entry.locationId)
            return (
              <button
                key={entry.locationId}
                type="button"
                className="btn btn-primary"
                onClick={() => setActiveLocationId(entry.locationId)}
              >
                {branch?.name ?? 'Location'}
                {entry.access === 'view_only' ? ' (view only)' : ''}
              </button>
            )
          })}
        </div>
      }
    />
  )
}
