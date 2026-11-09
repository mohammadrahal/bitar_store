'use client'

import Link from 'next/link'
import { Menu } from '@base-ui/react/menu'
import { ChevronDown, LogOut, Settings, UserCog } from 'lucide-react'
import { useLogout } from '@/hooks/use-auth'
import { usePermission } from '@/hooks/use-permission'
import { initials } from '@/lib/format'
import { adminHubHref } from '@/lib/admin-hub'

export function UserMenu() {
  const { user, can } = usePermission()
  const logout = useLogout()

  return (
    <Menu.Root>
      <Menu.Trigger
        render={(props) => (
          <button type="button" className="user-menu-trigger" aria-label={`Account: ${user.name}`} {...props}>
            <span className="avatar" aria-hidden="true">
              {initials(user.name)}
            </span>
            <span className="user-menu-text">
              <strong>{user.name}</strong>
            </span>
            <ChevronDown size={16} className="user-menu-chevron" aria-hidden="true" />
          </button>
        )}
      />
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8}>
          <Menu.Popup className="menu-popup">
            <div className="menu-header">
              <strong>{user.name}</strong>
            </div>
            <Menu.LinkItem
              className="menu-item"
              render={(props) => (
                <Link href="/account" {...props}>
                  <UserCog size={16} aria-hidden="true" />
                  Your account
                </Link>
              )}
            />
            {can('settings.manage') && (
              <Menu.LinkItem
                className="menu-item"
                render={(props) => (
                  <Link href={adminHubHref('settings')} {...props}>
                    <Settings size={16} aria-hidden="true" />
                    Store settings
                  </Link>
                )}
              />
            )}
            <Menu.Item className="menu-item danger" onClick={() => logout.mutate()} disabled={logout.isPending}>
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
