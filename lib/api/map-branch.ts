import type { ApiBranch } from '@/lib/api/types'
import type { Branch } from '@/types'

export function mapApiBranch(branch: ApiBranch): Branch {
  return {
    id: branch.id,
    name: branch.name,
    code: branch.code,
    location: branch.code,
    kind: branch.kind ?? 'branch',
    isActive: branch.isActive,
    createdAt: branch.createdAt,
  }
}
