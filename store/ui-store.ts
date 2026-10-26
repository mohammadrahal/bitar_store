import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { INVOICE_KINDS, INVOICE_STATUSES } from '@/lib/invoices'
import { ALL_BRANCHES, type BranchScope, type InvoiceKind, type InvoiceStatus } from '@/types'

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
  /** Header branch filter, only offered to users who can see every branch. */
  branchScope: BranchScope
  setBranchScope: (scope: BranchScope) => void
  invoiceSearch: string
  setInvoiceSearch: (search: string) => void
  /** 'all', or one InvoiceKind. Kept as a string so the select needs no cast. */
  invoiceKind: InvoiceKind | 'all'
  setInvoiceKind: (kind: string) => void
  invoiceStatus: InvoiceStatus | 'all'
  setInvoiceStatus: (status: string) => void
}

function asKind(value: string): InvoiceKind | 'all' {
  return INVOICE_KINDS.includes(value as InvoiceKind) ? (value as InvoiceKind) : 'all'
}

function asStatus(value: string): InvoiceStatus | 'all' {
  return INVOICE_STATUSES.includes(value as InvoiceStatus) ? (value as InvoiceStatus) : 'all'
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
      branchScope: ALL_BRANCHES,
      setBranchScope: (branchScope) => set({ branchScope }),
      invoiceSearch: '',
      setInvoiceSearch: (invoiceSearch) => set({ invoiceSearch }),
      invoiceKind: 'all',
      setInvoiceKind: (kind) => set({ invoiceKind: asKind(kind) }),
      invoiceStatus: 'all',
      setInvoiceStatus: (status) => set({ invoiceStatus: asStatus(status) }),
    }),
    {
      name: 'bitar-fashion:ui:v1',
      skipHydration: true,
      partialize: ({ theme, sidebarCollapsed, branchScope }) => ({ theme, sidebarCollapsed, branchScope }),
    },
  ),
)
