import type { StaffUser } from '@/services/users.service'
import type { Role, User } from '@/types'

export function userBadgeId(id: string) {
  return `#${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

export function tenureLabel(createdAt: string | undefined) {
  if (!createdAt) return '—'
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return '—'
  const years = Math.max(0, new Date().getFullYear() - created.getFullYear())
  if (years < 1) {
    const months = Math.max(
      1,
      (new Date().getFullYear() - created.getFullYear()) * 12 + (new Date().getMonth() - created.getMonth()),
    )
    return `${months} ${months === 1 ? 'month' : 'months'}`
  }
  return `${years} ${years === 1 ? 'year' : 'years'}`
}

/** Session user plus optional staff row from `GET /users`. */
export function staffSubjectFromSession(user: User, staff?: StaffUser): StaffUser {
  if (staff) return staff
  return {
    id: user.id,
    email: user.email,
    fullName: user.name,
    role: user.role,
    isActive: true,
    hasPassword: true,
    deactivatedAt: null,
    createdAt: '',
    updatedAt: '',
    locations: user.locations,
    branchIds: user.branchIds,
    branchAccessMode: user.role === 'manager' && user.branchIds.length === 0 ? 'all' : 'selected',
  }
}

export function primaryBranchId(subject: StaffUser, fallback?: string | null) {
  if (fallback) return fallback
  return subject.branchIds[0] ?? subject.locations[0]?.locationId ?? ''
}

export function monthToDateRange() {
  const now = new Date()
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const to = now.toISOString().slice(0, 10)
  return { from, to }
}

export type ProfileVariant = 'executive' | 'employee'

export function profileVariantForRole(role: Role): ProfileVariant {
  return role === 'employee' ? 'employee' : 'executive'
}
