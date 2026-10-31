import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ALL_BRANCHES, type BranchScope } from '@/types'

export type Theme = 'light' | 'dark'

/**
 * The inline script in the document head has already resolved the theme from
 * storage or the OS, so the store reads it back off the element rather than
 * guessing and causing a flip after mount.
 */
function resolveInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

interface UIState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  productSearch: string
  setProductSearch: (search: string) => void
  productCategory: string
  setProductCategory: (category: string) => void
  productShow: 'active' | 'archived'
  setProductShow: (show: 'active' | 'archived') => void
  /** Header branch filter, only offered to users who can see every location. */
  branchScope: BranchScope
  setBranchScope: (scope: BranchScope) => void
  /** The location an employee with several assignments is working in. */
  activeLocationId: string | null
  setActiveLocationId: (locationId: string | null) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: resolveInitialTheme(),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      mobileNavOpen: false,
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      productSearch: '',
      setProductSearch: (productSearch) => set({ productSearch }),
      productCategory: '',
      setProductCategory: (productCategory) => set({ productCategory }),
      productShow: 'active',
      setProductShow: (productShow) => set({ productShow }),
      branchScope: ALL_BRANCHES,
      setBranchScope: (branchScope) => set({ branchScope }),
      activeLocationId: null,
      setActiveLocationId: (activeLocationId) => set({ activeLocationId }),
    }),
    {
      name: 'bitar-fashion:ui:v1',
      skipHydration: true,
      partialize: ({ theme, sidebarCollapsed, branchScope, activeLocationId }) => ({
        theme,
        sidebarCollapsed,
        branchScope,
        activeLocationId,
      }),
    },
  ),
)
