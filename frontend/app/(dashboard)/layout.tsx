import { AppShell } from '@/components/dashboard/app-shell'
import { DashboardUIProvider } from '@/components/dashboard/dashboard-ui-provider'
import { ReadyGate } from '@/components/dashboard/ready-gate'
import { InventoryProvider } from '@/components/inventory/inventory-provider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <InventoryProvider>
      <DashboardUIProvider>
        <AppShell>
          <ReadyGate>{children}</ReadyGate>
        </AppShell>
      </DashboardUIProvider>
    </InventoryProvider>
  )
}
