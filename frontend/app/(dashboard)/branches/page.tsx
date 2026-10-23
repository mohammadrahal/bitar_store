import type { Metadata } from 'next'
import { BranchesView } from '@/components/views/branches-view'

export const metadata: Metadata = { title: 'Branches' }

export default function BranchesPage() {
  return <BranchesView />
}
