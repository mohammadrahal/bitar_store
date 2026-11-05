import { Suspense } from 'react'
import { AccountView } from '@/components/account/account-view'

export const metadata = { title: 'Account' }

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountView />
    </Suspense>
  )
}
