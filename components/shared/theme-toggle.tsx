'use client'

import { useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useUIStore } from '@/store/ui-store'

/** Keeps the document in step with the stored theme after the head script ran. */
export function useThemeEffect() {
  const theme = useUIStore((state) => state.theme)

  useEffect(() => {
    const element = document.documentElement
    element.classList.toggle('dark', theme === 'dark')
    element.style.colorScheme = theme
  }, [theme])
}

export function ThemeToggle() {
  const theme = useUIStore((state) => state.theme)
  const toggleTheme = useUIStore((state) => state.toggleTheme)
  useThemeEffect()

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
