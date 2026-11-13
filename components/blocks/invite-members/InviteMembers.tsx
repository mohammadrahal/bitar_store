'use client'

import { useMemo, useState } from 'react'
import { MailPlus } from 'lucide-react'
import { formatShortDate, formatTime } from '@/lib/format'
import { inviteStatusLabel, inviteStatusPillClass } from '@/lib/invite-rows'

export type InviteEntryStatus = 'pending' | 'accepted' | 'expired'

export interface InviteEntry {
  id: string
  email: string
  role: string
  status: InviteEntryStatus
  sentAt: Date
}

function formatSentAt(date: Date) {
  const day = formatShortDate(date)
  return day ? `${day}, ${formatTime(date)}` : ''
}

export function InviteMembers({
  initialInvites,
  memberSeats,
  title = 'Invites',
  description,
  /** `nested` sits inside another panel (e.g. dashboard) with a top rule only. */
  variant = 'panel',
}: {
  initialInvites: InviteEntry[]
  /** Total seats licensed for the workspace (cap shown in the UI). */
  memberSeats: number
  title?: string
  description?: string
  variant?: 'panel' | 'nested'
}) {
  const [invites] = useState<InviteEntry[]>(() => initialInvites)

  const acceptedCount = useMemo(() => invites.filter((i) => i.status === 'accepted').length, [invites])
  const pendingCount = useMemo(() => invites.filter((i) => i.status === 'pending').length, [invites])

  return (
    <section
      className={`invite-members-block ${variant === 'nested' ? 'invite-members-block--nested' : ''}`}
      aria-labelledby="invite-members-heading"
    >
      <div className="invite-members-block__head">
        <div>
          <h3 id="invite-members-heading" className="invite-members-block__title">
            {title}
          </h3>
          {description ? <p className="invite-members-block__desc muted">{description}</p> : null}
        </div>
        <div className="invite-members-block__meta">
          <span className="tabular-nums">
            {acceptedCount} active · {pendingCount} pending
          </span>
          <span className="muted">·</span>
          <span className="tabular-nums">
            up to {memberSeats} seats
          </span>
        </div>
      </div>

      {invites.length === 0 ? (
        <p className="invite-members-block__empty muted">
          No invites yet. Sending invitations from this screen is not wired to the API yet.
        </p>
      ) : (
        <div className="table-wrap invite-members-block__table">
          <table>
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">
                  Sent
                </th>
              </tr>
            </thead>
            <tbody>
              {invites.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="invite-members-block__email">
                      <MailPlus size={14} aria-hidden="true" className="invite-members-block__email-icon" />
                      {row.email}
                    </span>
                  </td>
                  <td className="capitalize">{row.role}</td>
                  <td>
                    <span className={`pill ${inviteStatusPillClass(row.status)}`}>
                      <span className="pill-dot" aria-hidden="true" />
                      {inviteStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="num muted tabular-nums">{formatSentAt(row.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
