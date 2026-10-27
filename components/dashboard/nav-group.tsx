'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { NavGroupItem } from '@/components/dashboard/nav-entries'

/**
 * A nav section that opens and closes, so Sales keeps its children out of the
 * way until they are wanted. Collapsed sidebars never get here — they flatten
 * the children into plain icons.
 */
export function NavGroup({
  entry,
  current,
  groupActive,
  onNavigate,
}: {
  entry: NavGroupItem
  current: string | null
  groupActive: boolean
  onNavigate?: () => void
}) {
  const [open, setOpen] = useState(groupActive)
  const panelId = `nav-group-${entry.label.toLowerCase()}`

  /* Navigating into the group opens it, so the active child is never hidden. */
  useEffect(() => {
    if (groupActive) setOpen(true)
  }, [groupActive])

  return (
    <div className={`nav-group ${groupActive ? 'active' : ''} ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="nav-item nav-group-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <entry.icon size={18} aria-hidden="true" />
        <span>{entry.label}</span>
        <ChevronDown size={16} className="nav-group-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="nav-sublist" id={panelId} role="list">
          {entry.children.map(({ href, label, icon: Icon }) => {
            const active = href === current
            return (
              <Link
                key={href}
                href={href}
                className={`nav-item nav-subitem ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                role="listitem"
                onClick={onNavigate}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
