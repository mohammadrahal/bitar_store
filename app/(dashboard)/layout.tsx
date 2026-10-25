import { AppShell } from '@/components/dashboard/app-shell'
import { AuthGate } from '@/components/shared/auth-gate'
import { BranchGuard } from '@/components/shared/branch-guard'
import { HydrationGate } from '@/components/shared/hydration-gate'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <HydrationGate>
      <AuthGate>
        <AppShell>
          <BranchGuard>{children}</BranchGuard>
        </AppShell>
      </AuthGate>
    </HydrationGate>
  )
}
