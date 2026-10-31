import type { Branch } from '@/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/*
 * A branch page is addressed by the store code — `/branches/hamra` rather than
 * `/branches/01647dfc-…`. Codes are unique across the network and fixed once
 * created, which is what makes them safe in a URL. An id still resolves, so
 * every link ever shared keeps working; the page then rewrites the address.
 */

/** True when a URL segment is an id rather than a code. */
export function isBranchId(segment: string): boolean {
  return UUID.test(segment)
}

export function branchSlug(branch: Pick<Branch, 'id' | 'code'>): string {
  const code = branch.code?.trim()
  return code ? code.toLowerCase() : branch.id
}

export function branchHref(branch: Pick<Branch, 'id' | 'code'>): string {
  return `/branches/${branchSlug(branch)}`
}

/** Matches a URL segment against one branch: its code in any case, or its id. */
export function matchesBranchSlug(branch: Pick<Branch, 'id' | 'code'>, segment: string): boolean {
  return branch.id === segment || branchSlug(branch) === segment.trim().toLowerCase()
}
