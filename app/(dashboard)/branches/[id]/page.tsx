import { BranchDetailView } from '@/components/branches/branch-detail-view'

export const metadata = { title: 'Branch' }

export default async function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <BranchDetailView branchId={id} />
}
