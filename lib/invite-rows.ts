import type { InviteEntry, InviteEntryStatus } from '@/components/blocks/invite-members/InviteMembers'

export function inviteStatusPillClass(status: InviteEntryStatus) {
  if (status === 'accepted') return 'pill-healthy'
  if (status === 'expired') return 'pill-neutral'
  return 'pill-accent'
}

export function inviteStatusLabel(status: InviteEntryStatus) {
  if (status === 'pending') return 'Pending'
  if (status === 'accepted') return 'Accepted'
  return 'Expired'
}
