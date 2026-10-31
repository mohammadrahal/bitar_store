'use client'

import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { useBranches } from '@/hooks/use-branches'
import type { User } from '@/types'

/** Where this account may work, and whether it may only look. */
export function ProfileLocations({ user }: { user: User }) {
  const { data: branches, isPending } = useBranches()

  if (user.locations.length === 0) {
    return (
      <div className="panel-body">
        <p className="muted">No location is assigned to this account yet.</p>
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Assigned locations</caption>
        <thead>
          <tr>
            <th scope="col">Location</th>
            <th scope="col">Access</th>
          </tr>
        </thead>
        <MotionTbody>
          {user.locations.map((assignment, index) => {
            const branch = branches?.find((candidate) => candidate.id === assignment.locationId)
            const full = assignment.access === 'full'
            return (
              <MotionTr key={assignment.locationId} index={index}>
                <td>
                  <strong>{branch?.name ?? (isPending ? 'Loading…' : 'Unknown location')}</strong>
                  {branch?.code && <small>{branch.code}</small>}
                </td>
                <td>
                  <span className={`pill ${full ? 'pill-healthy' : 'pill-neutral'}`}>
                    <span className="pill-dot" aria-hidden="true" />
                    {full ? 'Full access' : 'View only'}
                  </span>
                </td>
              </MotionTr>
            )
          })}
        </MotionTbody>
      </table>
    </div>
  )
}
