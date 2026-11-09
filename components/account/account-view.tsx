'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AccountIdentityDossier } from '@/components/users/user-profile-dossier'
import { ProfileTab } from '@/components/account/profile-tab'
import { PreferencesTab } from '@/components/account/preferences-tab'
import { SecurityTab } from '@/components/account/security-tab'
import { PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TAB_IDS = ['profile', 'security', 'preferences'] as const
type TabId = (typeof TAB_IDS)[number]

function parseTab(value: string | null): TabId {
  if (value && TAB_IDS.includes(value as TabId)) return value as TabId
  return 'profile'
}

export function AccountView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = useMemo(() => parseTab(searchParams.get('tab')), [searchParams])

  const setTab = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'profile') params.delete('tab')
      else params.set('tab', next)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return (
    <>
      <PageHeader eyebrow="Your account" title="Account" description="Identity dossier, security, and how this browser behaves." />
      <AccountIdentityDossier />
      <Tabs value={tab} onValueChange={setTab} className="account-tabs">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
        <TabsContent value="preferences">
          <PreferencesTab />
        </TabsContent>
      </Tabs>
    </>
  )
}
