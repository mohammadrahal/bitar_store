'use client'

import type { Branch, LocationAccess, LocationAssignment } from '@/types'

/**
 * Which locations an employee may work in, and how. A view-only assignment
 * shows that location's stock and nothing else, so it is a radio pair rather
 * than a second checkbox: a location is one or the other.
 */
export function LocationAssignmentsField({
  branches,
  value,
  onChange,
  disabled,
  error,
}: {
  branches: Branch[] | undefined
  value: LocationAssignment[]
  onChange: (next: LocationAssignment[]) => void
  disabled?: boolean
  error?: string
}) {
  const accessOf = (locationId: string) => value.find((entry) => entry.locationId === locationId)?.access

  const toggle = (locationId: string, assigned: boolean) => {
    if (!assigned) {
      onChange(value.filter((entry) => entry.locationId !== locationId))
      return
    }
    onChange([...value, { locationId, access: 'full' }])
  }

  const setAccess = (locationId: string, access: LocationAccess) => {
    onChange(value.map((entry) => (entry.locationId === locationId ? { ...entry, access } : entry)))
  }

  if (!branches?.length) {
    return (
      <div className="field full">
        <span className="field-hint">No locations to assign yet.</span>
      </div>
    )
  }

  return (
    <fieldset className="field full">
      <legend>Locations</legend>
      <ul className="assignment-list">
        {branches.map((branch) => {
          const access = accessOf(branch.id)
          const assigned = access !== undefined
          return (
            <li key={branch.id}>
              <label className="assignment-row">
                <input
                  type="checkbox"
                  checked={assigned}
                  disabled={disabled}
                  onChange={(event) => toggle(branch.id, event.target.checked)}
                />
                <span>
                  {branch.name} <span className="muted">{branch.code ?? branch.location}</span>
                </span>
              </label>
              {assigned && (
                <div className="assignment-access" role="radiogroup" aria-label={`Access at ${branch.name}`}>
                  {(['full', 'view_only'] as LocationAccess[]).map((option) => (
                    <label key={option}>
                      <input
                        type="radio"
                        name={`access-${branch.id}`}
                        checked={access === option}
                        disabled={disabled}
                        onChange={() => setAccess(branch.id, option)}
                      />
                      {option === 'full' ? 'Full access' : 'View-only stock'}
                    </label>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {error && <span className="field-error">{error}</span>}
    </fieldset>
  )
}
