'use client'

import Link from 'next/link'
import { Menu } from '@base-ui/react/menu'
import { ChevronDown, LogOut, Moon, Settings, Sun, UserCog } from 'lucide-react'
import { useBranches } from '@/hooks/use-branches'
import { useLogout } from '@/hooks/use-auth'
import { usePermission } from '@/hooks/use-permission'
import { useUserPreferences } from '@/hooks/use-user-preferences'
import { initials } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/permissions'
import { applyResolvedTheme, resolveThemePreference } from '@/lib/theme'
import type { ThemePreference } from '@/services/user-preferences.service'
import { useUIStore } from '@/store/ui-store'

function ThemeMenuToggle() {
  const { preferences, update } = useUserPreferences()
  const setTheme = useUIStore((state) => state.setTheme)

  const cycle = () => {
    const order: ThemePreference[] = ['light', 'dark', 'system']
    const index = order.indexOf(preferences.theme)
    const next = order[(index + 1) % order.length]
    update({ theme: next })
    const resolved = resolveThemePreference(next)
    setTheme(resolved)
    applyResolvedTheme(resolved)
  }

  const icon =
    preferences.theme === 'dark' ? (
      <Moon size={16} aria-hidden="true" />
    ) : preferences.theme === 'light' ? (
      <Sun size={16} aria-hidden="true" />
    ) : (
      <Sun size={16} aria-hidden="true" />
    )

  const label =
    preferences.theme === 'system'
      ? 'Theme: System'
      : preferences.theme === 'dark'
        ? 'Theme: Dark'
        : 'Theme: Light'

  return (
    <Menu.Item className="menu-item" onClick={cycle}>
      {icon}
      {label}
    </Menu.Item>
  )
}

export function UserMenu() {
  const { user, locationScoped, can } = usePermission()
  const { data: branches } = useBranches()
  const logout = useLogout()

  const where = locationScoped
    ? (branches?.find((branch) => branch.id === user.branchId)?.name ??
      (user.branchId ? 'Unknown branch' : 'No branch assigned'))
    : 'All locations'

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
              <small>{ROLE_LABELS[user.role]}</small>
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
              <small>{ROLE_LABELS[user.role]}</small>
              <small>{user.email}</small>
              <small>{where}</small>
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
                  <Link href="/settings" {...props}>
                    <Settings size={16} aria-hidden="true" />
                    Store settings
                  </Link>
                )}
              />
            )}
            <ThemeMenuToggle />
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
