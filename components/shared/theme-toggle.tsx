'use client'

import { useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useUserPreferences } from '@/hooks/use-user-preferences'
import { applyResolvedTheme } from '@/lib/theme'
import { useUIStore } from '@/store/ui-store'

/** Keeps the document in step with the stored theme after the head script ran. */
export function useThemeEffect() {
  const theme = useUIStore((state) => state.theme)
  useEffect(() => {
    applyResolvedTheme(theme)
  }, [theme])
}

export function ThemeToggle() {
  const theme = useUIStore((state) => state.theme)
  const setTheme = useUIStore((state) => state.setTheme)
  const { update } = useUserPreferences()
  useThemeEffect()

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  const toggle = () => {
    update({ theme: nextTheme })
    setTheme(nextTheme)
    applyResolvedTheme(nextTheme)
  }

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggle}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
