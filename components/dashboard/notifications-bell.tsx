'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Popover } from '@base-ui/react/popover'
import { Bell, Check } from 'lucide-react'
import { useAttention } from '@/hooks/use-attention'
import { useBranchScope } from '@/hooks/use-branch-scope'
import { formatBadgeCount, formatNumber } from '@/lib/format'

/**
 * The same rows as the overview's attention list, reachable from every screen.
 *
 * It shares one query with that list rather than counting anything itself, so
 * the bell and the page can never disagree. and a figure that only appears in
 * the header would be a second source of truth for the same question.
 *
 * The badge counts items, not rows: "3" where three transfers are waiting, not
 * "1" because they arrived as one kind of problem.
 */
export function NotificationsBell() {
  const scope = useBranchScope()
  /* The badge is a count, so the closed bell asks for counts only. The "sent
     over N days ago" clause costs a walk through the shipment list, and this
     sits in the header of every screen. so it is fetched when the popup opens,
     which is the only moment it is read. */
  const [open, setOpen] = useState(false)
  const { rows, total, isPending } = useAttention(scope, { detail: open })

  /* Nothing to say and nothing on its way: no bell at all rather than one that
     can only ever report silence. */
  if (isPending && rows.length === 0) return null

  const label = total > 0 ? `Notifications: ${formatNumber(total)} need attention` : 'Notifications: all clear'

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="icon-btn notifications-trigger"
        aria-label={label}
        render={(props) => (
          <button type="button" {...props}>
            <Bell size={18} aria-hidden="true" />
            {total > 0 && (
              <span className="notifications-badge tabular" aria-hidden="true">
                {total > 99 ? '99+' : formatBadgeCount(total)}
              </span>
            )}
          </button>
        )}
      />
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8}>
          <Popover.Popup className="menu-popup notifications-popup">
            <p className="menu-label">Needs attention</p>
            {rows.length === 0 ? (
              <p className="notifications-clear">
                <span className="attention-clear-icon" aria-hidden="true">
                  <Check size={14} />
                </span>
                All clear
              </p>
            ) : (
              <ul className="notifications-list">
                {rows.map((row) => (
                  <li key={row.key}>
                    <Link href={row.href} className="notifications-item">
                      <span className="notifications-item-count tabular">{formatNumber(row.count)}</span>
                      <span className="notifications-item-text">
                        <strong>{row.label}</strong>
                        {row.detail && <small>{row.detail}</small>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
