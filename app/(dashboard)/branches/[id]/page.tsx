import { BranchDetailView } from '@/components/branches/branch-detail-view'

export const metadata = { title: 'Branch' }

export default async function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  /* The segment is the store code; an id from an older link still resolves. */
  return <BranchDetailView slug={id} />
}
